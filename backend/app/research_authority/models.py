from sqlalchemy import event

from app.database.base import Base
from app.research_authority.integrity_v1 import install
from app.research_authority.schema_v1 import tables

_tables = tables(Base.metadata)


class SchedulerConfiguration(Base):
    __table__ = _tables[0]


class ResearchProtocol(Base):
    __table__ = _tables[1]


class ResearchSet(Base):
    __table__ = _tables[2]


class ResearchSetMembership(Base):
    __table__ = _tables[3]


class ParticipantAllocation(Base):
    __table__ = _tables[4]


class ParticipantSetCondition(Base):
    __table__ = _tables[5]


@event.listens_for(Base.metadata, "after_create")
def install_d11_guards(metadata, connection, **kwargs):
    if connection.dialect.name == "postgresql":
        install(connection)
