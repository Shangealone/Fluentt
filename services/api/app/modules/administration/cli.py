"""Operator-only local provisioning. Run with a restricted operator DB credential, never via HTTP."""

import argparse
import sys

from sqlalchemy import select, delete, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.usernames import validate_new_username
from app.db.engine import build_engine
from app.db.session import session_factory
from app.models.users import AdminIdentity, AdminPermission, AdminRole, AdminRolePermission, AdminUserRole, User
from app.modules.administration.repository import AdminRepository
from app.modules.administration.service import PERMISSION, utcnow


def provision(repo, username, issuer, subject):
    canonical = validate_new_username(username)
    Settings.validate_issuer(issuer)
    if not subject or len(subject) > 255 or subject != subject.strip():
        raise ValueError("Use the exact nonempty provider subject (maximum 255 characters)")
    with repo.transaction():
        if repo.session.scalar(select(User.id).where(User.canonical_username == canonical)):
            raise ValueError("Username is already allocated; existing accounts are never promoted")
        if repo.identity_user(issuer, subject):
            raise ValueError("Provider identity is already provisioned")
        # Concurrent provisioning of the shared role/permission serializes within this transaction.
        from sqlalchemy import text

        repo.session.execute(text("SELECT pg_advisory_xact_lock(78080001)"))
        role = repo.session.scalar(select(AdminRole).where(AdminRole.name == "administrator_shell"))
        if role is None:
            role = repo.add(AdminRole(name="administrator_shell", description="Section 08 dashboard access only"))
        permission = repo.session.scalar(select(AdminPermission).where(AdminPermission.code == PERMISSION))
        if permission is None:
            permission = repo.add(AdminPermission(code=PERMISSION))
        if (
            repo.session.scalar(
                select(AdminRolePermission.id).where(
                    AdminRolePermission.role_id == role.id, AdminRolePermission.permission_id == permission.id
                )
            )
            is None
        ):
            repo.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))
        user = repo.add(User(username=username, role="administrator", profile_status="active"))
        repo.add(AdminIdentity(user_id=user.id, issuer=issuer, subject=subject))
        repo.add(AdminUserRole(user_id=user.id, role_id=role.id))
        repo.audit("admin.provisioned", utcnow(), entity=user.id, reason="operator_cli")
        return user.id


def revoke(repo, username, *, disable=False):
    canonical = validate_new_username(username)
    now = utcnow()
    with repo.transaction():
        user = repo.session.scalar(select(User).where(User.canonical_username == canonical).with_for_update())
        if user is None or user.role != "administrator":
            raise ValueError("No separate administrator account matches")
        if disable:
            user.profile_status = "disabled"
        count = repo.revoke_all(user.id, now)
        repo.audit(
            "admin.disabled" if disable else "admin.sessions_revoked", now, entity=user.id, reason="operator_cli"
        )
        return count


def curriculum_permission(repo, username, *, grant, access="reader"):
    return content_permission(repo, username, grant=grant, access=access, domain="curriculum")


def questions_permission(repo, username, *, grant, access="reader"):
    return content_permission(repo, username, grant=grant, access=access, domain="questions")


def grading_permission(repo, username, *, grant, access="reader"):
    return content_permission(repo, username, grant=grant, access=access, domain="grading")


def content_permission(repo, username, *, grant, access, domain):
    """Only explicit section-approved policies; never arbitrary RBAC administration."""
    if domain not in {"curriculum", "questions", "grading"}:
        raise ValueError("Unknown content permission domain")
    policies = {
        "reader": {domain + ".read"},
        "editor": {domain + ".read", domain + ".write"},
        "publisher": {domain + ".read", domain + ".publish"},
    }
    if domain == "grading":
        policies = {"reader": {"grading.read"}, "runner": {"grading.read", "grading.run"}}
    if access not in policies:
        raise ValueError("Unknown content access policy")
    allowed = policies[access]
    controlled = domain + (
        ".read"
        if access == "reader"
        else ".run"
        if access == "runner"
        else ".write"
        if access == "editor"
        else ".publish"
    )
    canonical = validate_new_username(username)
    with repo.transaction():
        user = repo.session.scalar(
            select(User)
            .join(AdminIdentity, AdminIdentity.user_id == User.id)
            .where(User.canonical_username == canonical)
            .with_for_update(of=User)
            .execution_options(populate_existing=True)
        )
        if user is None or user.role != "administrator":
            raise ValueError("No separate administrator account matches")
        if grant and (
            user.profile_status != "active"
            or user.archived_at is not None
            or PERMISSION not in repo.permissions(user.id)
        ):
            raise ValueError("Only active provisioned administrators can receive content access")
        repo.session.execute(text("SELECT pg_advisory_xact_lock(78080001)"))
        role = repo.session.scalar(select(AdminRole).where(AdminRole.name == domain + "_" + access))
        if grant:
            if role is None:
                role = repo.add(AdminRole(name=domain + "_" + access, description="Explicit " + domain + " " + access))
            existing = set(
                repo.session.scalars(
                    select(AdminPermission.code)
                    .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
                    .where(AdminRolePermission.role_id == role.id)
                )
            )
            if existing - allowed:
                raise ValueError("Existing content role has unexpected permissions; operator review required")
            for code in sorted(allowed):
                permission = repo.session.scalar(select(AdminPermission).where(AdminPermission.code == code))
                if permission is None:
                    permission = repo.add(AdminPermission(code=code))
                if (
                    repo.session.scalar(
                        select(AdminRolePermission.id).where(
                            AdminRolePermission.role_id == role.id, AdminRolePermission.permission_id == permission.id
                        )
                    )
                    is None
                ):
                    repo.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))
            if (
                repo.session.scalar(
                    select(AdminUserRole.id).where(AdminUserRole.user_id == user.id, AdminUserRole.role_id == role.id)
                )
                is None
            ):
                repo.add(AdminUserRole(user_id=user.id, role_id=role.id))
        elif role is not None:
            repo.session.execute(
                delete(AdminUserRole).where(AdminUserRole.user_id == user.id, AdminUserRole.role_id == role.id)
            )
        if not grant and controlled in repo.permissions(user.id):
            raise ValueError("Another role still grants the controlled permission; operator review required")
        repo.audit(
            ("admin." + domain + "_read" if access == "reader" else "admin." + domain + "_" + access)
            + ("_granted" if grant else "_revoked"),
            utcnow(),
            entity=user.id,
            reason="operator_cli",
        )


def main(argv=None):
    parser = argparse.ArgumentParser(description="FLUENTT operator-only administrator provisioning/revocation")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("provision")
    create.add_argument("--username", required=True)
    create.add_argument("--issuer", required=True)
    create.add_argument("--subject", required=True)
    for name in (
        "disable",
        "revoke-all",
        "grant-curriculum-read",
        "revoke-curriculum-read",
        "grant-curriculum-editor",
        "revoke-curriculum-editor",
        "grant-curriculum-publisher",
        "revoke-curriculum-publisher",
        "grant-questions-read",
        "revoke-questions-read",
        "grant-questions-editor",
        "revoke-questions-editor",
        "grant-questions-publisher",
        "revoke-questions-publisher",
        "grant-grading-read",
        "revoke-grading-read",
        "grant-grading-run",
        "revoke-grading-run",
    ):
        commands.add_parser(name).add_argument("--username", required=True)
    args = parser.parse_args(argv)
    engine = None
    try:
        settings = Settings()
        engine = build_engine(settings)
        if engine is None:
            raise ValueError("Configure the operator PostgreSQL connection locally first")
        with session_factory(engine)() as session:
            repo = AdminRepository(session)
            if args.command == "provision":
                provision(repo, args.username, args.issuer, args.subject)
                print("Administrator provisioned with dashboard access.")
            elif "grading-" in args.command:
                grading_permission(
                    repo,
                    args.username,
                    grant=args.command.startswith("grant-"),
                    access="runner" if args.command.endswith("-run") else "reader",
                )
                print("Grading permission updated.")
            elif "curriculum-" in args.command or "questions-" in args.command:
                access = args.command.rsplit("-", 1)[1]
                content_permission(
                    repo,
                    args.username,
                    grant=args.command.startswith("grant-"),
                    access="reader" if access == "read" else access,
                    domain="questions" if "questions-" in args.command else "curriculum",
                )
                print("Content permission updated.")
            else:
                count = revoke(repo, args.username, disable=args.command == "disable")
                print(f"Operation completed; {count} browser sessions revoked.")
        return 0
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except SQLAlchemyError:
        print(
            "Database operation failed; check connectivity, migration and uniqueness without exposing credentials.",
            file=sys.stderr,
        )
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
