import uuid

import pytest
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import create_access_token
from app.pronunciation import azure_adapter, converter
from tests.pronunciation.fakes import FakeConverter, FakeProvider
from tests.pronunciation_helpers import publish_dev_seed


@pytest.fixture
def learner(db_session: Session) -> User:
    user = User(
        email="pron_learner@example.com",
        password_hash="mock_hash_for_token_auth",
        participant_code="P_PRON_01",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(learner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(learner.id))}"}


@pytest.fixture
def refs(db_session: Session) -> dict[str, dict[str, str]]:
    return publish_dev_seed(db_session)


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch) -> FakeProvider:
    fake = FakeProvider()
    monkeypatch.setattr(azure_adapter, "assess_utterance", fake)
    return fake


@pytest.fixture
def fake_converter(monkeypatch: pytest.MonkeyPatch) -> FakeConverter:
    fake = FakeConverter()
    monkeypatch.setattr(converter, "convert_to_wav", fake)
    return fake


@pytest.fixture
def other_owner(db_session: Session) -> User:
    user = User(
        email="pron_other_owner@example.com",
        password_hash="mock_hash_for_token_auth",
        participant_code="P_PRON_02",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_owner_headers(other_owner: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(other_owner.id))}"}


@pytest.fixture
def any_client_id() -> uuid.UUID:
    return uuid.uuid4()
