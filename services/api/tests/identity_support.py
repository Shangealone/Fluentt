"""Test-only repository double. This does not prove PostgreSQL persistence."""

from contextlib import contextmanager
from copy import deepcopy
from threading import RLock

from app.core.usernames import normalize_username


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
        from app.modules.identity.schemas import MobileProfile

        result = MobileProfile.model_validate(user)
        result.grade = getattr(user, "test_grade", None)
        result.language = getattr(user, "test_language", None)
        return result

    def update_preferences(self, user, payload):
        if payload.grade is not None:
            user.test_grade = payload.grade
        if payload.language is not None:
            user.test_language = payload.language
        complete = getattr(user, "test_grade", None) and getattr(user, "test_language", None)
        user.profile_status = "active" if complete else "onboarding"
        user.onboarding_step = None if complete else "personal_preferences"
