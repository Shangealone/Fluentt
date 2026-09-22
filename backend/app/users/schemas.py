import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.users.models import SupportedLanguage


class LearnerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    participant_code: str
    email: str
    interface_language: SupportedLanguage | None
    target_learning_language: SupportedLanguage | None
    created_at: datetime
    updated_at: datetime


class UpdatePreferencesRequest(BaseModel):
    interface_language: SupportedLanguage | None = None
    target_learning_language: SupportedLanguage | None = None
