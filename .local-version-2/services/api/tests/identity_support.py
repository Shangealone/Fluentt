"""Test-only repository double. This does not prove PostgreSQL persistence."""

from contextlib import contextmanager
from copy import deepcopy
from threading import RLock

from app.core.usernames import normalize_username


def existing_school_account(client, username):
    """Seed a legacy unenrolled student for authorization/enrollment tests, not signup tests."""
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4
    from app.core.security import hash_password, issue_credential
    from app.models.users import User, UserSession
    from app.modules.identity.dependencies import get_identity_repository
    from app.modules.identity.schemas import CreatedUser, MobileProfile, IssuedSession

    app = client.app
    while not hasattr(app, "dependency_overrides"):
        app = app.app
    repo = app.dependency_overrides[get_identity_repository]()
    now = datetime.now(timezone.utc)
    user = User(id=uuid4(), username=username, role="school_student", profile_status="onboarding",
                onboarding_step="class_enrollment", password_hash=hash_password("SyntheticPass123!"),
                created_at=now, updated_at=now)
    credential = issue_credential()
    session = UserSession(id=uuid4(), user_id=user.id, credential_digest=credential.digest,
                          created_at=now, updated_at=now, expires_at=now + timedelta(days=30),
                          absolute_expires_at=now + timedelta(days=90))
    with repo.transaction():
        repo.add_user(user)
        repo.add_profile(user)
        repo.add_session(session)
    return CreatedUser(user=MobileProfile.model_validate(user), session=IssuedSession(
        credential=credential.raw, expires_at=session.expires_at,
        absolute_expires_at=session.absolute_expires_at)).model_dump(mode="json")


class MemoryIdentityRepository:
    def __init__(self):
        self.users = {}
        self.sessions = {}
        self.profiles = {}
        self._lock = RLock()

    @contextmanager
    def transaction(self):
        with self._lock:
            snapshot = deepcopy((self.users, self.sessions, self.profiles))
            try:
                yield
            except Exception:
                self.users, self.sessions, self.profiles = snapshot
                raise

    def username_exists(self, canonical):
        return canonical in self.users

    def find_user_by_canonical_username(self, canonical):
        return self.users.get(canonical)

    def add_user(self, user):
        user.canonical_username = normalize_username(user.username)
        self.users[user.canonical_username] = user

    def add_profile(self, user):
        self.profiles[user.id] = "instructor" if user.role == "instructor" else "learner"

    def add_session(self, session):
        self.sessions[session.credential_digest] = session

    def flush(self):
        pass

    def lock_session(self, digest):
        session = self.sessions.get(digest)
        if session is None:
            return None
        user = next(user for user in self.users.values() if user.id == session.user_id)
        return session, user

    def mobile_profile(self, user):
        from app.modules.identity.schemas import LearningFocus, MobileProfile

        result = MobileProfile.model_validate(user)
        result.grade = getattr(user, "test_grade", None)
        result.language = getattr(user, "test_language", None)
        focus = getattr(user, "test_focus", None)
        result.learning_focus = LearningFocus.model_validate(focus) if focus else None
        return result

    def update_preferences(self, user, payload):
        if payload.grade is not None:
            user.test_grade = payload.grade
        if payload.language is not None:
            user.test_language = payload.language
        if payload.learning_focus is not None:
            user.test_focus = payload.learning_focus.model_dump()
        complete = (getattr(user, "test_focus", None) or getattr(user, "test_grade", None)) and getattr(
            user, "test_language", None
        )
        user.profile_status = "active" if complete else "onboarding"
        user.onboarding_step = None if complete else "personal_preferences"
