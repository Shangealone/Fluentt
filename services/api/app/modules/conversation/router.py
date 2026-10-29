"""FastAPI router for AI conversation practice, scenario browsing, and interactive dialogue."""

from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request

from app.modules.classrooms.router import Credential, Repo
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from app.modules.conversation.schemas import (
    ConversationTopicsResponse,
    ConversationTopicDTO,
    ConversationSessionCreateRequest,
    ConversationSessionDTO,
    SendMessageRequest,
    SendMessageResponseDTO,
    ConversationSessionSummaryDTO,
)
from app.modules.conversation.service import (
    get_eligible_conversation_topics,
    get_conversation_topic,
    start_conversation_session,
    get_conversation_session,
    send_conversation_message,
    end_conversation_session,
)

router = APIRouter(
    prefix="/me/conversation",
    tags=["conversation"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/topics", response_model=ConversationTopicsResponse)
def list_topics(
    request: Request,
    credential: Credential,
    repo: Repo,
    language: str | None = Query(default=None),
):
    """Lists published conversation practice scenarios for the learner."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_eligible_conversation_topics(repo.session, user, language=language)


@router.get("/topics/{topic_id}", response_model=ConversationTopicDTO)
def get_topic(
    request: Request,
    credential: Credential,
    repo: Repo,
    topic_id: UUID,
):
    """Retrieves full details, persona, and starters for a specific conversation scenario."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_conversation_topic(repo.session, topic_id)


@router.post("/sessions", response_model=ConversationSessionDTO)
def create_session(
    request: Request,
    credential: Credential,
    repo: Repo,
    body: ConversationSessionCreateRequest,
):
    """Starts a new bounded conversation session and delivers the opening AI greeting."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return start_conversation_session(
            repo.session, user, topic_id=body.topic_id, class_id=body.class_id
        )


@router.get("/sessions/{session_id}", response_model=ConversationSessionDTO)
def get_session(
    request: Request,
    credential: Credential,
    repo: Repo,
    session_id: UUID,
):
    """Fetches an existing conversation session and all its messages."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_conversation_session(repo.session, user, session_id=session_id)


@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponseDTO)
def send_message(
    request: Request,
    credential: Credential,
    repo: Repo,
    session_id: UUID,
    body: SendMessageRequest,
):
    """Sends a learner message (text or audio attempt) and receives the AI reply + formative feedback."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return send_conversation_message(
            repo.session,
            user,
            session_id=session_id,
            content=body.content,
            audio_attempt_id=body.audio_attempt_id,
        )


@router.post("/sessions/{session_id}/end", response_model=ConversationSessionSummaryDTO)
def end_session(
    request: Request,
    credential: Credential,
    repo: Repo,
    session_id: UUID,
):
    """Concludes the conversation practice session and retrieves the formative summary."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return end_conversation_session(repo.session, user, session_id=session_id)
