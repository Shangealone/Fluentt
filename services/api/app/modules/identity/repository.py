from contextlib import contextmanager
from collections.abc import Iterator

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from app.models.curriculum import GradeLevel
from app.modules.identity.schemas import LearningFocus, MobileProfile
from sqlalchemy.orm import Session

from app.models.users import InstructorProfile, LearnerProfile, User, UserSession, Classroom
from app.modules.enrollment.queries import eligible_memberships


class IdentityRepository:
    def __init__(self, session: Session):
        self.session = session

    @contextmanager
    def transaction(self) -> Iterator[None]:
        with self.session.begin():
            yield

    def username_exists(self, canonical: str) -> bool:
        return self.session.scalar(select(User.id).where(User.canonical_username == canonical).limit(1)) is not None

    def add_user(self, user: User) -> None:
        self.session.add(user)
        self.session.flush()

    def add_profile(self, user: User) -> None:
        profile = InstructorProfile(user_id=user.id) if user.role == "instructor" else LearnerProfile(user_id=user.id)
        self.session.add(profile)

    def add_session(self, session: UserSession) -> None:
        self.session.add(session)

    def flush(self) -> None:
        self.session.flush()

    def lock_session(self, digest: str) -> tuple[UserSession, User] | None:
        row = self.session.execute(
            select(UserSession, User)
            .join(User, User.id == UserSession.user_id)
            .where(UserSession.credential_digest == digest)
            .with_for_update(of=[UserSession, User])
        ).one_or_none()
        return (row[0], row[1]) if row is not None else None

    def mobile_profile(self, user: User) -> MobileProfile:
        result = MobileProfile.model_validate(user)
        if user.role == "school_student":
            enrolled = self.session.scalar(eligible_memberships(user.id).limit(1)) is not None
            result.profile_status = "active" if enrolled else "onboarding"
            result.onboarding_step = None if enrolled else "class_enrollment"
        if user.role == "instructor":
            has_classes = (
                self.session.scalar(select(Classroom.id).where(Classroom.instructor_id == user.id).limit(1)) is not None
            )
            result.profile_status = "active" if has_classes else "onboarding"
            result.onboarding_step = None if has_classes else "first_class"
        if user.role == "personal_student":
            learner = self.session.scalar(select(LearnerProfile).where(LearnerProfile.user_id == user.id))
            if learner is not None:
                grade = self.session.get(GradeLevel, learner.preferred_grade_id) if learner.preferred_grade_id else None
                result.grade = grade.number if grade else None
                result.language = learner.preferred_language
                result.learning_focus = (
                    LearningFocus.model_validate(learner.learning_focus) if learner.learning_focus else None
                )
        return result

    def update_preferences(self, user: User, payload) -> None:
        learner = self.session.scalar(select(LearnerProfile).where(LearnerProfile.user_id == user.id).with_for_update())
        if payload.grade is not None:
            # Reference labels only; no curriculum content. Unique number resolves concurrent inserts.
            self.session.execute(
                insert(GradeLevel)
                .values(number=payload.grade, name=f"Grade {payload.grade}")
                .on_conflict_do_nothing(index_elements=[GradeLevel.number])
            )
            learner.preferred_grade_id = self.session.scalar(
                select(GradeLevel.id).where(GradeLevel.number == payload.grade)
            )
        if payload.language is not None:
            learner.preferred_language = payload.language
        if payload.learning_focus is not None:
            learner.learning_focus = payload.learning_focus.model_dump()
        self.session.flush()
        complete = (
            learner.learning_focus is not None or learner.preferred_grade_id is not None
        ) and learner.preferred_language is not None
        user.profile_status = "active" if complete else "onboarding"
        user.onboarding_step = None if complete else "personal_preferences"
