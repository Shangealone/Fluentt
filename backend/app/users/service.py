from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.users.models import LearnerProfile


def get_or_create_profile(db: Session, user: User) -> LearnerProfile:
    profile = db.scalar(
        select(LearnerProfile).where(LearnerProfile.user_id == user.id)
    )
    if not profile:
        profile = LearnerProfile(
            user_id=user.id,
            interface_language=None,
            target_learning_language=None,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def update_profile_preferences(
    db: Session,
    user: User,
    *,
    interface_language: str | None = None,
    target_learning_language: str | None = None,
) -> LearnerProfile:
    profile = get_or_create_profile(db, user)
    if interface_language is not None:
        profile.interface_language = interface_language
    if target_learning_language is not None:
        profile.target_learning_language = target_learning_language

    db.commit()
    db.refresh(profile)
    return profile
