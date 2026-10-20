"""Pydantic schemas for AI conversation practice, scenarios, and formative feedback."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FormativeLanguageFeedbackDTO(BaseModel):
    summary: str
    corrections: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    politeness_marker_detected: bool | None = None
    topic_relevance_score: float = Field(default=1.0, ge=0.0, le=1.0)
    confidence: float = Field(default=0.90, ge=0.0, le=1.0)
    uncertainty_notice: str = (
        "Formative feedback provides practice guidance based on educational language heuristics. "
        "It does not constitute certified human-level evaluation or official DepEd grading."
    )


class ConversationTopicDTO(BaseModel):
    id: UUID
    lesson_id: UUID | None = None
    title: str
    language: str
    scenario_description: str
    persona: str
    target_level: str
    goal: str
    vocabulary_hints: list[str] = Field(default_factory=list)
    starter_prompt: str
    status: str
    version: int


class ConversationTopicsResponse(BaseModel):
    topics: list[ConversationTopicDTO]
    total: int


class ConversationSessionCreateRequest(BaseModel):
    topic_id: UUID
    class_id: UUID | None = None


class ConversationMessageDTO(BaseModel):
    id: UUID
    sequence: int
    role: str  # "user" | "assistant"
    content: str
    sent_at: datetime
    feedback: FormativeLanguageFeedbackDTO | None = None
    pronunciation_score: float | None = None
    transcription: str | None = None
    audio_attempt_id: UUID | None = None


class ConversationSessionDTO(BaseModel):
    session_id: UUID
    topic_id: UUID
    topic_title: str
    language: str
    persona: str
    started_at: datetime
    ended_at: datetime | None = None
    status: str  # "active" | "ended" | "failed"
    simulated: bool
    model_version: str
    turns_count: int
    max_turns: int
    messages: list[ConversationMessageDTO] = Field(default_factory=list)


class SendMessageRequest(BaseModel):
    content: str | None = Field(default=None, max_length=1000)
    audio_attempt_id: UUID | None = None


class SendMessageResponseDTO(BaseModel):
    session_id: UUID
    user_message: ConversationMessageDTO
    assistant_message: ConversationMessageDTO
    turns_count: int
    max_turns: int
    is_session_complete: bool
    simulated: bool


class ConversationSessionSummaryDTO(BaseModel):
    session_id: UUID
    status: str
    turns_completed: int
    overall_feedback: str
    strengths: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    ended_at: datetime
