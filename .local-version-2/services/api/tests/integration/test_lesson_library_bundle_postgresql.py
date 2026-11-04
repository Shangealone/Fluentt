"""Content-only library transfer, using isolated databases and no account export."""
import copy
import json
import pytest
from sqlalchemy import select, func, text
from app.db.base import Base
from app.modules.curriculum.library_bundle import export_bundle, import_bundle, validate_bundle

pytestmark = pytest.mark.postgresql


def test_export_contains_only_curriculum_content(db, graph):
    bundle = export_bundle(db.connection())
    assert bundle["tables"]["lessons"][0]["name"] == "Synthetic lesson"
    assert not {"users", "classes", "assignments", "sessions"} & bundle["tables"].keys()
    assert all(row.get("author_id") is None for row in bundle["tables"]["questions"])
    assert "SyntheticTeacher" not in json.dumps(bundle)
    assert "SyntheticStudent" not in json.dumps(bundle)
    invalid = copy.deepcopy(bundle)
    invalid["tables"]["users"] = []
    with pytest.raises(ValueError):
        validate_bundle(invalid)


def test_committed_library_roundtrip_and_repeat_are_safe(db):
    from app.modules.curriculum.library_bundle import load_bundle, DEFAULT_BUNDLE
    bundle = load_bundle(DEFAULT_BUNDLE)
    with db.begin_nested():
        connection = db.connection()
        first = import_bundle(connection, bundle)
        assert first["inserted"] > 0
        second = import_bundle(connection, bundle)
        assert second["inserted"] == 0 and second["updated"] == 0
        assert connection.scalar(select(func.count()).select_from(Base.metadata.tables["users"])) == 0
        assert export_bundle(connection)["tables"] == bundle["tables"]


def test_existing_identical_drafts_can_receive_the_shared_publication(db, graph):
    from app.modules.curriculum.library_bundle import seal_bundle
    bundle = export_bundle(db.connection())
    published = copy.deepcopy(bundle)
    for name in ("curriculum_versions", "curriculum_topics", "lessons"):
        published["tables"][name][0]["status"] = "published"
    published["tables"]["curriculum_versions"][0]["published_at"] = "2026-11-04T00:00:00+00:00"
    seal_bundle(published)
    result = import_bundle(db.connection(), published)
    assert result["inserted"] == 0 and result["updated"] == 3
    assert import_bundle(db.connection(), published)["updated"] == 0


def test_conflicting_library_preserves_local_records(db):
    from app.modules.curriculum.library_bundle import load_bundle, DEFAULT_BUNDLE
    bundle = load_bundle(DEFAULT_BUNDLE)
    # A conflicting local lesson must never be overwritten; reject within a savepoint.
    with db.begin_nested():
        connection = db.connection()
        import_bundle(connection, bundle)
        original = connection.scalar(text("SELECT count(*) FROM lessons"))
        changed = copy.deepcopy(bundle)
        changed["tables"]["lessons"][0]["name"] = "Conflicting replacement"
        from app.modules.curriculum.library_bundle import seal_bundle
        seal_bundle(changed)
        with pytest.raises(ValueError, match="conflict"):
            with connection.begin_nested():
                import_bundle(connection, changed)
        assert connection.scalar(text("SELECT count(*) FROM lessons")) == original
