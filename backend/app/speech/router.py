from functools import lru_cache
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.core.config import Settings, get_settings
from app.database.session import get_db
from app.speech.audio import MAX_BYTES, parse_pcm16
from app.speech.schemas import (
    AssessmentPrediction,
    AssessmentResponse,
    Capability,
    RecognitionPrediction,
    RecognitionResponse,
    SpeechCapabilities,
    WorkerCapability,
)
from app.speech.service import align_transcript, reference_words, resolve_speech_target
from app.speech.worker_client import SpeechWorkerClient, WorkerUnavailable

router = APIRouter(prefix="/speech", tags=["speech"])
RECOGNITION_CONSENT = "speech-recognition-v1"
ASSESSMENT_CONSENT = "speech-assessment-v1"


@lru_cache(maxsize=4)
def _workers(recognition_url, assessment_url, token, maximum, timeout):
    return {
        kind: SpeechWorkerClient(url, token, kind, maximum, timeout)
        for kind, url in [
            ("recognition", recognition_url),
            ("assessment", assessment_url),
        ]
    }


def get_workers(settings: Annotated[Settings, Depends(get_settings)]):
    return _workers(
        settings.speech_recognition_url,
        settings.speech_assessment_url,
        settings.speech_service_token,
        settings.speech_max_inflight,
        settings.speech_worker_timeout_seconds,
    )


CurrentUser = Annotated[User, Depends(get_current_user)]
Database = Annotated[Session, Depends(get_db)]
Configuration = Annotated[Settings, Depends(get_settings)]
Workers = Annotated[dict[str, SpeechWorkerClient], Depends(get_workers)]


async def capability(kind, language, user_id, settings, workers):
    if language != "en":
        return Capability(reason="unsupported_language")
    enabled = getattr(settings, f"speech_{kind}_enabled")
    qa = user_id in settings.speech_internal_qa_user_ids
    if not enabled and not qa:
        return Capability(reason="not_enabled")
    try:
        status = WorkerCapability.model_validate(
            await run_in_threadpool(workers[kind].capability)
        )
        if not status.ready:
            return Capability(reason="model_unavailable")
        mode = (
            "learner"
            if enabled and status.validation_status == "validated"
            else "internal_qa"
            if qa
            else "unavailable"
        )
        return Capability(
            mode=mode,
            reason="ready" if mode != "unavailable" else "not_validated",
            **{
                k: getattr(status, k)
                for k in ("model_id", "model_revision", "validation_status")
            },
        )
    except (WorkerUnavailable, ValueError, TypeError):
        return Capability(reason="model_unavailable")


@router.get("/capabilities", response_model=SpeechCapabilities)
async def capabilities(
    response: Response,
    language_code: Literal["en", "fil"],
    user: CurrentUser,
    db: Database,
    settings: Configuration,
    workers: Workers,
):
    response.headers["Cache-Control"] = "no-store"
    user_id = user.id
    db.rollback()
    return SpeechCapabilities(
        language_code=language_code,
        recognition=await capability(
            "recognition", language_code, user_id, settings, workers
        ),
        assessment=await capability(
            "assessment", language_code, user_id, settings, workers
        ),
    )


async def process(kind, request, user, db, settings, workers):
    consent = RECOGNITION_CONSENT if kind == "recognition" else ASSESSMENT_CONSENT
    if request.headers.get(f"x-{kind}-consent") != consent:
        raise HTTPException(
            403, "Please allow this audio processing before continuing."
        )
    try:
        request_id = str(UUID(request.headers["x-speech-request-id"]))
        UUID(request.headers["x-speech-session-id"])
        sequence = int(request.headers["x-speech-sequence"])
        final_header = request.headers["x-speech-final"]
        if not 0 <= sequence <= 10000 or final_header not in ("true", "false"):
            raise ValueError("Invalid sequence")
        final = final_header == "true"
        if kind == "assessment" and not final:
            raise ValueError("Assessment requires complete recording")
        ids = [
            UUID(request.headers[key])
            for key in (
                "x-content-item-id",
                "x-content-revision-id",
                "x-content-release-id",
            )
        ]
        rate, channels = (
            int(request.headers["x-audio-sample-rate"]),
            int(request.headers["x-audio-channels"]),
        )
    except (KeyError, ValueError):
        raise HTTPException(
            422, "Recording details are incomplete. Please record again."
        ) from None
    user_id = user.id
    target = await run_in_threadpool(resolve_speech_target, db, *ids)
    cap = await capability(kind, target.language, user_id, settings, workers)
    if cap.mode == "unavailable":
        raise HTTPException(503, "Speech practice is unavailable right now.")
    if (
        request.headers.get("content-type", "").split(";")[0]
        != "application/octet-stream"
    ):
        raise HTTPException(415, "Use PCM audio.")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Keep your recording under ten seconds.")
        body.extend(chunk)
    try:
        recording = parse_pcm16(bytes(body), rate, channels)
    except ValueError:
        raise HTTPException(
            422, "We could not use this recording. Please record again."
        ) from None
    try:
        raw = await run_in_threadpool(
            workers[kind].infer,
            recording,
            target.language,
            target.text if kind == "assessment" else "",
        )
        schema = (
            RecognitionPrediction if kind == "recognition" else AssessmentPrediction
        )
        prediction = schema.model_validate(raw)
        if any(
            getattr(prediction, field) != getattr(cap, field)
            for field in ("model_id", "model_revision", "validation_status")
        ):
            raise ValueError("Model changed")
        if kind == "recognition":
            return RecognitionResponse(
                **prediction.model_dump(),
                request_id=request_id,
                sequence=sequence,
                is_final=final,
                words=align_transcript(target.text, prediction.transcript, final),
            )
        if [w.word.casefold() for w in prediction.words] != [
            w.casefold() for w in reference_words(target.text)
        ]:
            raise ValueError("Incomplete reference coverage")
        return AssessmentResponse(
            **prediction.model_dump(),
            request_id=request_id,
            duration_ms=recording.duration_ms,
        )
    except (WorkerUnavailable, ValueError, TypeError, KeyError):
        raise HTTPException(
            503, "We could not process this recording. Please make a new recording."
        ) from None


@router.post("/recognitions", response_model=RecognitionResponse)
async def recognize(
    request: Request,
    response: Response,
    user: CurrentUser,
    db: Database,
    settings: Configuration,
    workers: Workers,
):
    response.headers["Cache-Control"] = "no-store"
    return await process("recognition", request, user, db, settings, workers)


@router.post("/assessments", response_model=AssessmentResponse)
async def assess(
    request: Request,
    response: Response,
    user: CurrentUser,
    db: Database,
    settings: Configuration,
    workers: Workers,
):
    response.headers["Cache-Control"] = "no-store"
    return await process("assessment", request, user, db, settings, workers)
