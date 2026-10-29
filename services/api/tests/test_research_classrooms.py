"""Pure configuration checks; no approvals, people or model outcomes are asserted."""

import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect
from sqlalchemy.schema import AddConstraint, CreateIndex, CreateTable

import app.models  # noqa: F401
from app.db.base import Base
from app.modules.research.classroom_schemas import CreateClassroomStudy, ProtocolConfiguration
from app.modules.research.classroom_service import EDGES, fingerprint


@pytest.mark.parametrize(
    "data",
    [
        {"active_weekdays": [True]},
        {"active_weekdays": [0]},
        {"active_weekdays": [8]},
        {"active_weekdays": [1, 1]},
        {"active_weekdays": []},
        {"timezone": "invented/timezone"},
        {"starts_at": "2027-01-01T00:00:00"},
        {"starts_at": "2027-02-02T00:00:00Z", "ends_at": "2027-02-01T00:00:00Z"},
        {"consent_requirements": ["assent", "assent"]},
        {"ethics_approved": True},
        {"declared_evidence": {"ethics": " "}},
        {"due_date_policy": {"version": "v1", "reference": "fixture", "parameters": {"large": "a" * 65536}}},
    ],
)
def test_invalid_or_invented_configuration_rejected(data):
    with pytest.raises(ValidationError):
        ProtocolConfiguration.model_validate(data)


def test_draft_has_no_implicit_methodology_or_approval():
    data = ProtocolConfiguration().model_dump()
    assert data["starts_at"] is None and data["active_weekdays"] is None
    assert data["conditions"] == data["assessments"] == []
    assert data["declared_evidence"] == {}
    with pytest.raises(ValidationError):
        CreateClassroomStudy(code="syn", title="Synthetic", language="english", protocol_version="synthetic-v1")
    assert ProtocolConfiguration(active_weekdays=[5, 1], timezone="Asia/Manila").active_weekdays == [1, 5]


def test_windows_and_timers_are_explicit_and_bounded():
    from uuid import uuid4

    reference = {"assessment_id": str(uuid4()), "instrument_version": "synthetic-v1"}
    for invalid in (0, -1, True):
        with pytest.raises(ValidationError):
            ProtocolConfiguration(assessments=[reference | {"timer_limit_seconds": invalid}])
    with pytest.raises(ValidationError):
        ProtocolConfiguration(
            starts_at="2027-01-02T00:00:00Z", assessments=[reference | {"opens_at": "2027-01-01T00:00:00Z"}]
        )


def test_state_graph_and_retry_identity():
    assert EDGES["DRAFT"] == {"READY"} and not EDGES["COMPLETED"]
    assert "ACTIVE" not in EDGES["DRAFT"]
    assert fingerprint("edit", "id", {"a": 1, "b": 2}) == fingerprint("edit", "id", {"b": 2, "a": 1})
    assert fingerprint("edit", "id", {}) != fingerprint("bind", "id", {})


def test_seven_private_tables_match_frozen_additive_ddl():
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0017_research_classrooms.py"
    spec = importlib.util.spec_from_file_location("research_classrooms_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tables = [
        t for t in Base.metadata.sorted_tables if t.schema == "research_private" and t.name.startswith("classroom_")
    ]
    assert len(tables) == 7
    assert module.down_revision == "0016_learning_experience"
    ddl = {str(CreateTable(t).compile(dialect=dialect())).strip() for t in tables}
    ddl.update(
        str(AddConstraint(c).compile(dialect=dialect())).strip()
        for t in tables
        for c in t.foreign_key_constraints
        if c.use_alter
    )
    assert ddl == set(module.SCHEMA_SQL)
    assert {str(CreateIndex(i).compile(dialect=dialect())).strip() for t in tables for i in t.indexes} == set(
        module.INDEX_SQL
    )
    for table in tables:
        assert len({c.name for c in table.constraints}) == len(table.constraints)
        assert all(fk.column is not None for fk in table.foreign_keys)
