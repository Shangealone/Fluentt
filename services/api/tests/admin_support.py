"""Explicit test-only storage double; runtime always uses the PostgreSQL repository."""

from contextlib import nullcontext
from uuid import uuid4

from app.models.admin_sessions import AdminBrowserSession, AdminOIDCAttempt
from app.models.users import User


class MemoryAdminRepository:
    def __init__(self):
        self.attempts, self.sessions, self.events = [], [], []
        self.account = User(id=uuid4(), username="SyntheticAdmin", role="administrator", profile_status="active")
        self.granted = {"dashboard.view"}

    def transaction(self):
        return nullcontext()

    def add(self, row):
        row.id = uuid4()
        if isinstance(row, AdminOIDCAttempt):
            self.attempts.append(row)
        elif isinstance(row, AdminBrowserSession):
            self.sessions.append(row)
        return row

    def attempt(self, digest):
        return next((row for row in self.attempts if row.state_digest == digest), None)

    def identity_user(self, issuer, subject):
        return self.account if issuer == "https://id.example" and subject == "approved-subject" else None

    def user(self, user_id):
        return self.account if self.account and self.account.id == user_id else None

    def browser_session(self, digest, *, lock=False):
        return next((row for row in self.sessions if row.credential_digest == digest), None)

    def permissions(self, user_id):
        return self.granted

    def audit(self, action, now, **kwargs):
        self.events.append((action, kwargs))
