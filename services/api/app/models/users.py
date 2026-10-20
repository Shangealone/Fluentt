"""Profile identity is independent of class membership and research participation."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Computed, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base, Entity, choice, language, reference
from app.core.usernames import normalize_username


class User(Entity, Base):
    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(32))
    canonical_username: Mapped[str] = mapped_column(
        String(32), Computed('lower(btrim(username) COLLATE "C")', persisted=True), unique=True
    )
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        choice("role", "personal_student", "school_student", "instructor", "administrator")
    )
    profile_status: Mapped[str] = mapped_column(
        choice("profile_status", "onboarding", "active", "disabled", "archived"),
        default="onboarding",
        server_default="onboarding",
    )
    onboarding_step: Mapped[str | None] = mapped_column(String(80))
    archived_at: Mapped[datetime | None]
    sessions: Mapped[list["UserSession"]] = relationship(back_populates="user", passive_deletes="all")
    __table_args__ = (CheckConstraint("username ~ '^[A-Za-z0-9_][A-Za-z0-9_ ]{1,30}[A-Za-z0-9_]$'", name="username_format"),)

    @validates("username")
    def validate_username(self, key, value):
        normalize_username(value)
        return value.strip()


class LearnerProfile(Entity, Base):
    __tablename__ = "learner_profiles"
    user_id: Mapped[UUID] = reference("users.id", unique=True)
    preferred_grade_id: Mapped[UUID | None] = reference("grade_levels.id", nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(language())
    learning_focus: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    learning_experience: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class InstructorProfile(Entity, Base):
    __tablename__ = "instructor_profiles"
    user_id: Mapped[UUID] = reference("users.id", unique=True)
    display_name: Mapped[str | None] = mapped_column(String(120))


class UserSession(Entity, Base):
    __tablename__ = "user_sessions"
    user_id: Mapped[UUID] = reference("users.id")
    credential_digest: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime]
    absolute_expires_at: Mapped[datetime]
    last_used_at: Mapped[datetime | None]
    revoked_at: Mapped[datetime | None]
    device_label: Mapped[str | None] = mapped_column(String(100))
    user: Mapped[User] = relationship(back_populates="sessions")
    __table_args__ = (
        CheckConstraint("credential_digest ~ '^[0-9a-f]{64}$'", name="digest_format"),
        CheckConstraint("expires_at > created_at AND absolute_expires_at >= expires_at", name="expiry_order"),
        Index("ix_user_sessions_active", "user_id", "expires_at", postgresql_where=text("revoked_at IS NULL")),
    )


class AdminIdentity(Entity, Base):
    __tablename__ = "admin_identities"
    user_id: Mapped[UUID] = reference("users.id", unique=True)
    issuer: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(255))
    __table_args__ = (UniqueConstraint("issuer", "subject"),)


class AdminRole(Entity, Base):
    __tablename__ = "admin_roles"
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class AdminPermission(Entity, Base):
    __tablename__ = "admin_permissions"
    code: Mapped[str] = mapped_column(String(100), unique=True)


class AdminRolePermission(Entity, Base):
    __tablename__ = "admin_role_permissions"
    role_id: Mapped[UUID] = reference("admin_roles.id")
    permission_id: Mapped[UUID] = reference("admin_permissions.id")
    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)


class AdminUserRole(Entity, Base):
    __tablename__ = "admin_user_roles"
    user_id: Mapped[UUID] = reference("users.id")
    role_id: Mapped[UUID] = reference("admin_roles.id")
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)


class Classroom(Entity, Base):
    __tablename__ = "classes"
    instructor_id: Mapped[UUID] = reference("users.id")
    class_name: Mapped[str] = mapped_column(String(150))
    grade_level_id: Mapped[UUID] = reference("grade_levels.id")
    subject_id: Mapped[UUID | None] = reference("subjects.id", nullable=True)
    creation_request_id: Mapped[UUID | None]
    language: Mapped[str] = mapped_column(language())
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        choice("class_status", "active", "archived"), default="active", server_default="active"
    )
    archived_at: Mapped[datetime | None]
    memberships: Mapped[list["ClassMembership"]] = relationship(back_populates="classroom", passive_deletes="all")

    __table_args__ = (UniqueConstraint("instructor_id", "creation_request_id", name="uq_classes_owner_request"),)


class ClassJoinCode(Entity, Base):
    __tablename__ = "class_join_codes"
    class_id: Mapped[UUID] = reference("classes.id")
    code: Mapped[str] = mapped_column(String(6))
    status: Mapped[str] = mapped_column(
        choice("code_status", "active", "revoked", "expired"), default="active", server_default="active"
    )
    expires_at: Mapped[datetime | None]
    revoked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("code", name="uq_class_join_codes_code"),
        CheckConstraint("code ~ '^[0-9]{6}$'", name="six_digits"),
        CheckConstraint("status != 'active' OR revoked_at IS NULL", name="active_not_revoked"),
        CheckConstraint("expires_at IS NULL OR expires_at > created_at", name="expiry_order"),
        Index("uq_class_join_codes_active_code", "code", unique=True, postgresql_where=text("status = 'active'")),
        Index("uq_class_join_codes_active_class", "class_id", unique=True, postgresql_where=text("status = 'active'")),
    )


class ClassMembership(Entity, Base):
    __tablename__ = "class_memberships"
    class_id: Mapped[UUID] = reference("classes.id")
    student_id: Mapped[UUID] = reference("users.id")
    joined_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    status: Mapped[str] = mapped_column(
        choice("membership_status", "active", "left", "removed"), default="active", server_default="active"
    )
    ended_at: Mapped[datetime | None]
    classroom: Mapped[Classroom] = relationship(back_populates="memberships")
    __table_args__ = (
        Index(
            "uq_class_memberships_active",
            "class_id",
            "student_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )
