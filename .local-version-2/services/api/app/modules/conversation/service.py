"""Conversation service: Session management, topic seeding, dialogue turn orchestration, and audio linkage."""

from datetime import datetime, timezone, timedelta
from typing import Any
from uuid import UUID, uuid4
from sqlalchemy import select, func, and_, desc

from app.models.ai import (
    ConversationTopic,
    ConversationSession,
    ConversationMessage,
    PronunciationAttempt,
)
from app.models.learning import LearningContext
from app.models.research import ModelVersion, ModelConfiguration
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.service import get_or_create_learning_context
from app.modules.speech.service import transcribe_pronunciation_attempt, evaluate_pronunciation_attempt
from app.modules.conversation.schemas import (
    ConversationTopicDTO,
    ConversationTopicsResponse,
    ConversationSessionDTO,
    ConversationMessageDTO,
    SendMessageResponseDTO,
    ConversationSessionSummaryDTO,
    FormativeLanguageFeedbackDTO,
)
from app.modules.conversation.provider import ConversationProviderRegistry

MAX_SESSION_TURNS = 20

SEED_TOPICS = [
    {
        "id": UUID("10000000-0000-0000-0000-000000000001"),
        "title": "Pagpapakilala sa Sarili (Introducing Oneself)",
        "language": "tagalog",
        "scenario_description": "Kumustahan at pagpapakilala sa bagong kaklase sa paaralan.",
        "persona": "Juan (Bagong Kaklase)",
        "target_level": "Grade 7 (Panimula)",
        "goal": "Ipakilala ang sarili gamit ang magagalang na pananalita tulad ng 'po' at 'opo'.",
        "vocabulary_hints": ["pangalan", "taga-saan", "edad", "kinagagalak", "salamat po"],
        "starter_prompt": "Magandang araw! Ako si Juan, isang mag-aaral dito. Kumusta ka? Ano ang iyong pangalan?",
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000002"),
        "title": "Pamimili sa Pamilihan (Market Bargaining)",
        "language": "tagalog",
        "scenario_description": "Pamimili ng sariwang prutas at gulay sa palengke.",
        "persona": "Aling Nena (Tindera)",
        "target_level": "Grade 8 (Panggitna)",
        "goal": "Magtanong ng presyo, pumili ng mga prutas, at magbayad nang magalang.",
        "vocabulary_hints": ["magkano", "kilo", "tawad", "sukli", "sariwa", "bayad po"],
        "starter_prompt": "Magandang umaga! Sariwa ang mga mangga at saging ngayon. Ano po ang bibilhin ninyo?",
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000003"),
        "title": "Pagtatanong ng Direksyon (Asking for Directions)",
        "language": "tagalog",
        "scenario_description": "Pagtatanong ng direksyon patungo sa silid-aklatan sa kabayanan.",
        "persona": "Kuya Ramon (Mamamayan sa Kalsada)",
        "target_level": "Grade 8 (Panggitna)",
        "goal": "Magtanong at umintindi ng mga direksyon patungo sa silid-aklatan o plasa.",
        "vocabulary_hints": ["kaliwa", "kanan", "diretso", "kanto", "silid-aklatan", "malapit"],
        "starter_prompt": "Magandang hapon po! Mukhang naghahanap kayo ng lugar. Saan po ba ang inyong punta?",
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000004"),
        "title": "School Orientation & Friends (Campus Life)",
        "language": "english",
        "scenario_description": "Meeting a student buddy and discussing favorite classes and campus activities.",
        "persona": "Alex (Peer Buddy)",
        "target_level": "Grade 7 (Beginner)",
        "goal": "Introduce yourself in English and talk about favorite subjects and activities.",
        "vocabulary_hints": ["schedule", "library", "science lab", "favorite subject", "nice to meet you"],
        "starter_prompt": "Hi there! Welcome to our campus. I'm Alex from Grade 7. Which class are you heading to today?",
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000005"),
        "title": "Ordering at a Local Cafe (Everyday English)",
        "language": "english",
        "scenario_description": "Placing a beverage order and asking questions at a coffee shop.",
        "persona": "Chris (Friendly Barista)",
        "target_level": "Grade 9 (Conversational)",
        "goal": "Order beverages and snacks, ask for dietary options, and complete transactions politely.",
        "vocabulary_hints": ["iced coffee", "pastry", "takeout", "how much", "thank you"],
        "starter_prompt": "Good morning! Welcome to Fluentt Cafe. What can I get started for you today?",
    },
]


def get_or_create_conversation_model_configuration(db) -> ModelConfiguration:
    """Ensures a valid ModelVersion and ModelConfiguration exist for conversation sessions."""
    mv = db.scalar(
        select(ModelVersion).where(
            ModelVersion.task == "conversation_agent",
            ModelVersion.provider == "fluentt_local",
            ModelVersion.model_name == "fluentt-dialogue-v1.0",
            ModelVersion.version == "1.0.0",
        )
    )
    if not mv:
        mv = ModelVersion(
            id=UUID("00000000-0000-0000-0000-000000000007"),
            task="conversation_agent",
            provider="fluentt_local",
            model_name="fluentt-dialogue-v1.0",
            version="1.0.0",
            capabilities={"streaming": False, "role_play": True, "languages": ["tl", "en"]},
            artifact_reference="local://fluentt/dialogue/v1.0",
            simulated=True,
        )
        db.add(mv)
        db.flush()

    mc = db.scalar(
        select(ModelConfiguration).where(
            ModelConfiguration.model_version_id == mv.id,
            ModelConfiguration.version == 1,
        )
    )
    if not mc:
        mc = ModelConfiguration(
            id=UUID("00000000-0000-0000-0000-000000000008"),
            model_version_id=mv.id,
            version=1,
            parameters={
                "max_tokens": 150,
                "temperature": 0.7,
                "max_turns": MAX_SESSION_TURNS,
                "safety_guard": "standard_v1",
                "retention_days": 30,
            },
        )
        db.add(mc)
        db.flush()
    return mc


def seed_conversation_topics_if_empty(db) -> None:
    """Ensures default published curriculum conversation topics exist."""
    count = db.scalar(select(func.count(ConversationTopic.id))) or 0
    if count == 0:
        now = datetime.now(timezone.utc)
        for t in SEED_TOPICS:
            topic = ConversationTopic(
                id=t["id"],
                lesson_id=None,
                title=t["title"],
                language=t["language"],
                learning_context={
                    "scenario_description": t["scenario_description"],
                    "persona": t["persona"],
                    "target_level": t["target_level"],
                    "goal": t["goal"],
                    "vocabulary_hints": t["vocabulary_hints"],
                    "starter_prompt": t["starter_prompt"],
                },
                status="published",
                version=1,
                locked_at=now,
            )
            db.add(topic)
        db.flush()


def get_eligible_conversation_topics(
    db, user: User, language: str | None = None
) -> ConversationTopicsResponse:
    """Retrieves published conversation scenarios for the learner."""
    seed_conversation_topics_if_empty(db)
    query = select(ConversationTopic).where(ConversationTopic.status == "published")
    if language:
        canonical_lang = language.lower()
        if canonical_lang in ("tl", "tagalog", "filipino"):
            query = query.where(ConversationTopic.language == "tagalog")
        elif canonical_lang in ("en", "english"):
            query = query.where(ConversationTopic.language == "english")

    query = query.order_by(ConversationTopic.title)
    rows = list(db.scalars(query).all())

    items = []
    for r in rows:
        ctx = r.learning_context or {}
        items.append(
            ConversationTopicDTO(
                id=r.id,
                lesson_id=r.lesson_id,
                title=r.title,
                language=r.language,
                scenario_description=ctx.get("scenario_description", ""),
                persona=ctx.get("persona", "Practice Partner"),
                target_level=ctx.get("target_level", "All Levels"),
                goal=ctx.get("goal", ""),
                vocabulary_hints=ctx.get("vocabulary_hints", []),
                starter_prompt=ctx.get("starter_prompt", "Hello!"),
                status=r.status,
                version=r.version,
            )
        )
    return ConversationTopicsResponse(topics=items, total=len(items))


def get_conversation_topic(db, topic_id: UUID) -> ConversationTopicDTO:
    """Retrieves a single conversation scenario by UUID."""
    topic = db.scalar(select(ConversationTopic).where(ConversationTopic.id == topic_id))
    if not topic:
        raise IdentityError(404, "topic_not_found", f"Conversation topic {topic_id} was not found.")
    ctx = topic.learning_context or {}
    return ConversationTopicDTO(
        id=topic.id,
        lesson_id=topic.lesson_id,
        title=topic.title,
        language=topic.language,
        scenario_description=ctx.get("scenario_description", ""),
        persona=ctx.get("persona", "Practice Partner"),
        target_level=ctx.get("target_level", "All Levels"),
        goal=ctx.get("goal", ""),
        vocabulary_hints=ctx.get("vocabulary_hints", []),
        starter_prompt=ctx.get("starter_prompt", "Hello!"),
        status=topic.status,
        version=topic.version,
    )


def start_conversation_session(
    db, user: User, topic_id: UUID, class_id: UUID | None = None
) -> ConversationSessionDTO:
    """Initializes a new bounded conversational learning session and issues the AI greeting."""
    seed_conversation_topics_if_empty(db)
    topic = db.scalar(select(ConversationTopic).where(ConversationTopic.id == topic_id))
    if not topic:
        raise IdentityError(404, "topic_not_found", f"Conversation topic {topic_id} was not found.")

    if topic.status != "published":
        raise IdentityError(403, "topic_not_available", "Topic is not currently published for student practice.")

    # Context resolution
    context_type = "classroom" if class_id else "personal"
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)
    mc = get_or_create_conversation_model_configuration(db)

    now = datetime.now(timezone.utc)
    delete_after = now + timedelta(days=30)

    session = ConversationSession(
        id=uuid4(),
        context_id=context.id,
        topic_id=topic.id,
        language=topic.language,
        started_at=now,
        ended_at=None,
        model_configuration_id=mc.id,
        status="active",
        retain_messages=True,
        retention_policy_version="edu-retention-v1",
        delete_messages_after=delete_after,
        simulated=True,
    )
    db.add(session)
    db.flush()

    # Initial AI greeting message
    ctx = topic.learning_context or {}
    starter = ctx.get("starter_prompt", "Hello! Let's start our conversation.")
    greeting = ConversationMessage(
        id=uuid4(),
        session_id=session.id,
        sequence=1,
        role="assistant",
        content=starter,
        sent_at=now,
    )
    db.add(greeting)
    db.commit()

    return ConversationSessionDTO(
        session_id=session.id,
        topic_id=topic.id,
        topic_title=topic.title,
        language=session.language,
        persona=ctx.get("persona", "Partner"),
        started_at=session.started_at,
        ended_at=session.ended_at,
        status=session.status,
        simulated=session.simulated,
        model_version="fluentt-dialogue-v1.0",
        turns_count=1,
        max_turns=MAX_SESSION_TURNS,
        messages=[
            ConversationMessageDTO(
                id=greeting.id,
                sequence=greeting.sequence,
                role=greeting.role,
                content=greeting.content,
                sent_at=greeting.sent_at,
            )
        ],
    )


def get_conversation_session(db, user: User, session_id: UUID) -> ConversationSessionDTO:
    """Fetches an existing session and verifies student ownership."""
    session = db.scalar(select(ConversationSession).where(ConversationSession.id == session_id))
    if not session:
        raise IdentityError(404, "session_not_found", f"Conversation session {session_id} not found.")

    # Ownership verification
    context = db.scalar(select(LearningContext).where(LearningContext.id == session.context_id))
    if not context or context.student_id != user.id:
        raise IdentityError(403, "forbidden_session", "You do not own this conversation session.")

    topic = db.scalar(select(ConversationTopic).where(ConversationTopic.id == session.topic_id))
    topic_title = topic.title if topic else "Conversation Practice"
    ctx = topic.learning_context if topic else {}

    messages = list(
        db.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session.id)
            .order_by(ConversationMessage.sequence)
        ).all()
    )

    msg_dtos = [
        ConversationMessageDTO(
            id=m.id,
            sequence=m.sequence,
            role=m.role,
            content=m.content,
            sent_at=m.sent_at,
        )
        for m in messages
    ]

    return ConversationSessionDTO(
        session_id=session.id,
        topic_id=session.topic_id,
        topic_title=topic_title,
        language=session.language,
        persona=ctx.get("persona", "Partner"),
        started_at=session.started_at,
        ended_at=session.ended_at,
        status=session.status,
        simulated=session.simulated,
        model_version="fluentt-dialogue-v1.0",
        turns_count=len(messages),
        max_turns=MAX_SESSION_TURNS,
        messages=msg_dtos,
    )


def send_conversation_message(
    db,
    user: User,
    session_id: UUID,
    content: str | None = None,
    audio_attempt_id: UUID | None = None,
) -> SendMessageResponseDTO:
    """Processes a learner message (text or spoken audio), executes AI response turn, and returns feedback."""
    session = db.scalar(select(ConversationSession).where(ConversationSession.id == session_id))
    if not session:
        raise IdentityError(404, "session_not_found", f"Conversation session {session_id} not found.")

    context = db.scalar(select(LearningContext).where(LearningContext.id == session.context_id))
    if not context or context.student_id != user.id:
        raise IdentityError(403, "forbidden_session", "You do not own this conversation session.")

    if session.status != "active":
        raise IdentityError(400, "session_closed", f"Session is already {session.status}.")

    topic = db.scalar(select(ConversationTopic).where(ConversationTopic.id == session.topic_id))
    ctx = topic.learning_context if topic else {}

    # Audio vs. Text Input handling
    user_text = ""
    pron_score: float | None = None
    transcription: str | None = None

    if audio_attempt_id:
        att = db.scalar(select(PronunciationAttempt).where(PronunciationAttempt.id == audio_attempt_id))
        if not att:
            raise IdentityError(404, "audio_attempt_not_found", "Linked audio recording not found.")
        # Ensure transcribed
        if not att.transcription:
            transcribe_pronunciation_attempt(db, att.id)
            db.refresh(att)
        # Ensure evaluated
        if att.score is None and att.scoring_status != "unsupported":
            try:
                evaluate_pronunciation_attempt(db, att.id)
                db.refresh(att)
            except Exception:
                pass

        user_text = att.transcription or "[Inaudible or Silent Audio]"
        transcription = att.transcription
        pron_score = float(att.score) if att.score is not None else None
    else:
        if not content or not content.strip():
            raise IdentityError(422, "empty_message", "Message content cannot be empty.")
        user_text = content.strip()
        pron_score = None  # Text has no pronunciation score!

    # Current sequence
    last_seq = db.scalar(
        select(func.max(ConversationMessage.sequence)).where(
            ConversationMessage.session_id == session.id
        )
    ) or 0

    now = datetime.now(timezone.utc)
    user_seq = last_seq + 1

    # Insert user message
    user_msg = ConversationMessage(
        id=uuid4(),
        session_id=session.id,
        sequence=user_seq,
        role="user",
        content=user_text,
        sent_at=now,
    )
    db.add(user_msg)
    db.flush()

    # Load recent conversation history (up to last 10 messages)
    history_rows = list(
        db.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session.id)
            .order_by(ConversationMessage.sequence.desc())
            .limit(10)
        ).all()
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(history_rows)]

    # Run AI provider turn
    turns_count = user_seq + 1
    reply = ConversationProviderRegistry.reply(
        user_input=user_text,
        history=history,
        topic_context=ctx,
        language=session.language,
        turns_count=turns_count,
        max_turns=MAX_SESSION_TURNS,
    )

    asst_seq = user_seq + 1
    asst_msg = ConversationMessage(
        id=uuid4(),
        session_id=session.id,
        sequence=asst_seq,
        role="assistant",
        content=reply.assistant_text,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(asst_msg)

    # Check if max turns reached
    is_complete = asst_seq >= MAX_SESSION_TURNS
    if is_complete:
        session.status = "ended"
        session.ended_at = datetime.now(timezone.utc)

    db.commit()

    return SendMessageResponseDTO(
        session_id=session.id,
        user_message=ConversationMessageDTO(
            id=user_msg.id,
            sequence=user_msg.sequence,
            role=user_msg.role,
            content=user_msg.content,
            sent_at=user_msg.sent_at,
            pronunciation_score=pron_score,
            transcription=transcription,
            audio_attempt_id=audio_attempt_id,
        ),
        assistant_message=ConversationMessageDTO(
            id=asst_msg.id,
            sequence=asst_msg.sequence,
            role=asst_msg.role,
            content=asst_msg.content,
            sent_at=asst_msg.sent_at,
            feedback=reply.feedback,
        ),
        turns_count=asst_seq,
        max_turns=MAX_SESSION_TURNS,
        is_session_complete=is_complete,
        simulated=reply.simulated,
    )


def end_conversation_session(
    db, user: User, session_id: UUID
) -> ConversationSessionSummaryDTO:
    """Manually marks session as ended and produces a formative summary."""
    session = db.scalar(select(ConversationSession).where(ConversationSession.id == session_id))
    if not session:
        raise IdentityError(404, "session_not_found", f"Conversation session {session_id} not found.")

    context = db.scalar(select(LearningContext).where(LearningContext.id == session.context_id))
    if not context or context.student_id != user.id:
        raise IdentityError(403, "forbidden_session", "You do not own this conversation session.")

    now = datetime.now(timezone.utc)
    if session.status == "active":
        session.status = "ended"
        session.ended_at = now
        db.commit()

    # Calculate summary metrics
    messages_count = db.scalar(
        select(func.count(ConversationMessage.id)).where(
            ConversationMessage.session_id == session.id
        )
    ) or 0

    return ConversationSessionSummaryDTO(
        session_id=session.id,
        status="ended",
        turns_completed=messages_count,
        overall_feedback=(
            "Mahusay na pagtatapos ng pagsasanay sa pakikipag-usap! "
            "Patuloy na linangin ang bokabularyo at tiwala sa pagpapahayag."
            if session.language == "tagalog"
            else "Great job on your conversation practice session! "
            "Keep developing your confidence, spontaneous phrasing, and vocabulary breadth."
        ),
        strengths=[
            "Maintained active turn-taking within the practice scenario",
            "Polite and responsive engagement throughout dialogue turns",
        ],
        recommendations=[
            "Practice speaking full sentences with varied descriptive modifiers",
            "Review key vocabulary hints before starting the next conversation",
        ],
        ended_at=session.ended_at or now,
    )
