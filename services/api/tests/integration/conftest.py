"""Never migrate the supplied database: create a fresh UUID-named test database."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def pg_engine():
    raw = os.environ.get("FLUENTT_TEST_DATABASE_URL")
    if not raw:
        pytest.skip(
            "PostgreSQL unavailable/unconfigured: set FLUENTT_TEST_DATABASE_URL to a maintenance DB with CREATEDB"
        )
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg":
        pytest.fail("Integration tests require PostgreSQL with psycopg; SQLite is not supported")
    name = "fluentt_test_" + uuid4().hex
    admin = create_engine(
        url, isolation_level="AUTOCOMMIT", poolclass=NullPool, hide_parameters=True, connect_args={"connect_timeout": 5}
    )
    engine = None
    created = False
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))  # generated UUID, never user input
            created = True
        engine = create_engine(
            url.set(database=name),
            poolclass=NullPool,
            hide_parameters=True,
            connect_args={"connect_timeout": 5, "options": "-c timezone=UTC -c search_path=public"},
        )
        with engine.begin() as connection:
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            config.attributes["repair_initial_names"] = True
            command.upgrade(config, "head")
        yield engine
    except Exception as exc:
        pytest.fail(f"Disposable PostgreSQL setup/check failed ({type(exc).__name__}); connection details redacted")
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            # Only the UUID name created above is ever removed; never the supplied database.
            assert name.startswith("fluentt_test_") and len(name) == len("fluentt_test_") + 32
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


@pytest.fixture
def db(pg_engine):
    connection = pg_engine.connect()
    transaction = connection.begin()
    with Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as session:
        yield session
    transaction.rollback()
    connection.close()


@pytest.fixture
def graph(db):
    from app.models.curriculum import (
        CurriculumVersion,
        GradeLevel,
        Subject,
        CurriculumGrade,
        CurriculumSubject,
        Quarter,
        CurriculumTopic,
        Lesson,
    )
    from app.models.users import User, Classroom

    def add(obj):
        db.add(obj)
        db.flush()
        return obj

    instructor = add(User(username="SyntheticTeacher", role="instructor"))
    student = add(User(username="SyntheticStudent", role="school_student"))
    version = add(CurriculumVersion(code="synthetic-v1", name="Unverified synthetic test curriculum"))
    grade = add(GradeLevel(number=3, name="Grade 3"))
    subject = add(Subject(code="synthetic-filipino", name="Filipino"))
    curriculum_grade = add(CurriculumGrade(curriculum_version_id=version.id, grade_level_id=grade.id))
    curriculum_subject = add(CurriculumSubject(curriculum_grade_id=curriculum_grade.id, subject_id=subject.id))
    quarter = add(Quarter(curriculum_subject_id=curriculum_subject.id, number=1, name="Quarter 1"))
    topic = add(CurriculumTopic(quarter_id=quarter.id, name="Synthetic topic", position=1))
    lesson = add(Lesson(topic_id=topic.id, name="Synthetic lesson", position=1))
    classroom = add(
        Classroom(
            instructor_id=instructor.id,
            class_name="Synthetic class",
            grade_level_id=grade.id,
            subject_id=subject.id,
            language="tagalog",
        )
    )
    return {
        "add": add,
        "student": student,
        "instructor": instructor,
        "version": version,
        "grade": grade,
        "subject": subject,
        "quarter": quarter,
        "topic": topic,
        "lesson": lesson,
        "classroom": classroom,
    }
