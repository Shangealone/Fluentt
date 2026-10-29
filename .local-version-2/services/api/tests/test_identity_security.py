from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.core.rate_limit import IdentityRateLimiter, RateLimitExceeded
from app.core.security import credential_digest, issue_credential, valid_credential_format
from app.core.usernames import normalize_username, validate_new_username
from app.modules.identity.errors import IdentityError
from app.modules.identity.schemas import CreateUserRequest
from app.modules.identity.user_service import create_user
from tests.identity_support import MemoryIdentityRepository


def test_credentials_have_expected_entropy_encoding_and_digest_only_repr():
    credentials = [issue_credential() for _ in range(20)]
    assert len({issued.raw for issued in credentials}) == 20
    for issued in credentials:
        assert valid_credential_format(issued.raw) and len(issued.raw) == 47
        assert len(issued.digest) == 64 and credential_digest(issued.raw) == issued.digest
        assert issued.raw not in repr(issued) and issued.digest not in repr(issued)


def test_legacy_storage_and_new_registration_policy_are_explicit():
    assert normalize_username("  Shan123 ") == "shan123"
    assert normalize_username("A" * 32) == "a" * 32
    assert validate_new_username("A" * 24) == "a" * 24
    assert validate_new_username("Shan Gealone") == "shan gealone"
    assert normalize_username("Shan Gealone") == "shan gealone"
    for value in ["A" * 25, "  Shan123 ", "support"]:
        with pytest.raises(ValueError):
            validate_new_username(value)


def test_bounded_rate_limiter_window_and_scope(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr("app.core.rate_limit.time.monotonic", lambda: clock[0])
    limiter = IdentityRateLimiter(60, max_buckets=2)
    limiter.check("check", "peer", 1)
    with pytest.raises(RateLimitExceeded) as exc:
        limiter.check("check", "peer", 1)
    assert exc.value.retry_after == 60
    limiter.check("create", "peer", 1)
    with pytest.raises(RateLimitExceeded):
        limiter.check("check", "different-peer", 1)
    clock[0] += 60
    limiter.check("check", "different-peer", 1)
    assert len(limiter._buckets) == 1


@pytest.mark.parametrize(
    "values",
    [
        {"mobile_session_idle_days": 0},
        {"mobile_session_absolute_days": 0},
        {"username_check_limit": 0},
        {"user_creation_limit": 0},
        {"identity_rate_window_seconds": 0},
        {"mobile_session_request_limit": 0},
        {"mobile_session_idle_days": 91, "mobile_session_absolute_days": 90},
    ],
)
def test_invalid_identity_settings(values):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_creation_rolls_back_profile_if_session_issuance_cannot_persist():
    class BrokenRepository(MemoryIdentityRepository):
        def add_session(self, session):
            raise RuntimeError("Synthetic session persistence failure")

    repository = BrokenRepository()
    with pytest.raises(RuntimeError):
        create_user(
            repository, CreateUserRequest(username="learner", role="personal_student"), Settings(_env_file=None)
        )
    assert not repository.users and not repository.profiles and not repository.sessions


def test_concurrent_unique_constraint_error_maps_only_username_conflict():
    class ConflictRepository(MemoryIdentityRepository):
        def add_user(self, user):
            original = Exception("Redacted synthetic integrity error")
            original.sqlstate = "23505"
            original.diag = SimpleNamespace(constraint_name="uq_users_canonical_username")
            raise IntegrityError("INSERT", {}, original)

    with pytest.raises(IdentityError) as exc:
        create_user(
            ConflictRepository(),
            CreateUserRequest(username="learner", role="personal_student"),
            Settings(_env_file=None),
        )
    assert exc.value.status == 409


def test_unrelated_integrity_error_is_not_claimed_as_username_duplicate():
    class BrokenRepository(MemoryIdentityRepository):
        def add_user(self, user):
            original = Exception("Synthetic unrelated constraint")
            original.sqlstate = "23505"
            original.diag = SimpleNamespace(constraint_name="ix_user_sessions_credential_digest")
            raise IntegrityError("INSERT", {}, original)

    with pytest.raises(IntegrityError):
        create_user(
            BrokenRepository(), CreateUserRequest(username="learner", role="personal_student"), Settings(_env_file=None)
        )


def test_issued_response_repr_hides_raw_credential():
    result = create_user(
        MemoryIdentityRepository(),
        CreateUserRequest(username="User_" + uuid4().hex[:8], role="instructor"),
        Settings(_env_file=None),
    )
    assert result.session.credential not in repr(result)


def test_service_does_not_grant_admin_even_if_request_validation_is_bypassed():
    request = CreateUserRequest.model_construct(username="AdminAttempt", role="administrator")
    repository = MemoryIdentityRepository()
    with pytest.raises(IdentityError) as exc:
        create_user(repository, request, Settings(_env_file=None))
    assert exc.value.status == 422 and not repository.users
