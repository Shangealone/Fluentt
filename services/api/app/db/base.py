"""Shared declarative metadata. Import app.models to register every domain."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, MetaData, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )
    type_annotation_map = {dict: JSONB, datetime: DateTime(timezone=True)}


class Entity:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, server_default=text("gen_random_uuid()"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


def reference(target: str, *, nullable: bool = False, ondelete: str = "RESTRICT", **kwargs):
    return mapped_column(ForeignKey(target, ondelete=ondelete), nullable=nullable, index=True, **kwargs)


def choice(name: str, *values: str):
    return Enum(*values, name=name, native_enum=False, create_constraint=True, validate_strings=True)


def language():
    return choice("language", "english", "tagalog")


def publication():
    return choice("publication", "draft", "published", "archived")


def json_object():
    return mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))


def label():
    return mapped_column(String(200), nullable=False)
