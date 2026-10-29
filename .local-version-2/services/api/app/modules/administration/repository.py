from sqlalchemy import select, update

from app.models.admin_sessions import AdminBrowserSession, AdminOIDCAttempt
from app.models.operations import AuditLog
from app.models.users import AdminIdentity, AdminPermission, AdminRolePermission, AdminUserRole, User


class AdminRepository:
    def __init__(self, session):
        self.session = session

    def transaction(self):
        return self.session.begin()

    def add(self, row):
        self.session.add(row)
        self.session.flush()
        return row

    def attempt(self, state_digest):
        return self.session.scalar(
            select(AdminOIDCAttempt)
            .where(AdminOIDCAttempt.state_digest == state_digest)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def identity_user(self, issuer, subject):
        return self.session.scalar(
            select(User)
            .join(AdminIdentity, AdminIdentity.user_id == User.id)
            .where(AdminIdentity.issuer == issuer, AdminIdentity.subject == subject)
            .with_for_update(of=User)
            .execution_options(populate_existing=True)
        )

    def user(self, user_id):
        return self.session.scalar(
            select(User)
            .join(AdminIdentity, AdminIdentity.user_id == User.id)
            .where(User.id == user_id)
            .with_for_update(of=User)
            .execution_options(populate_existing=True)
        )

    def browser_session(self, credential_digest, *, lock=False):
        statement = select(AdminBrowserSession).where(AdminBrowserSession.credential_digest == credential_digest)
        return self.session.scalar(
            statement.with_for_update().execution_options(populate_existing=True) if lock else statement
        )

    def permissions(self, user_id):
        return set(
            self.session.scalars(
                select(AdminPermission.code)
                .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
                .join(AdminUserRole, AdminUserRole.role_id == AdminRolePermission.role_id)
                .where(AdminUserRole.user_id == user_id)
            )
        )

    def revoke_all(self, user_id, now):
        return self.session.execute(
            update(AdminBrowserSession)
            .where(AdminBrowserSession.user_id == user_id, AdminBrowserSession.revoked_at.is_(None))
            .values(revoked_at=now)
        ).rowcount

    def audit(self, action, now, *, actor=None, entity=None, reason=None, request_id=None):
        self.add(
            AuditLog(
                actor_id=actor,
                action=action,
                entity_type="admin_auth",
                entity_id=entity,
                occurred_at=now,
                request_id=request_id,
                safe_metadata={"reason": reason} if reason else {},
            )
        )
