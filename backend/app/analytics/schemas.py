from pydantic import BaseModel, ConfigDict


class LearnerProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vocabulary_items_studied: int
    review_attempts_completed: int
    correct_attempts: int
    accuracy_rate: float
