import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.core.config import get_settings
from app.database.session import get_db
from app.pronunciation import service
from app.pronunciation.responses import PronunciationJSONResponse as JSONResponse
from app.pronunciation.schemas import PronunciationAttemptMetadata

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])
settings = get_settings()

MAX_AUDIO_BYTES = 262_144
MAX_METADATA_BYTES = 4_096
MAX_BODY_BYTES = 278_528
EXPECTED_PARTS = {"metadata", "audio"}

SAFE_DETAILS = {
    "UPLOAD_LIMIT": "Your recording is too large. Please record again.",
    "EMPTY_RECORDING": "No recording was received. Please record again.",
    "INVALID_METADATA": "The pronunciation request could not be verified.",
    "INVALID_TARGET": "This practice item is unavailable.",
    "DURATION_LIMIT": "The recording is too long. Please record again.",
    "UNSUPPORTED_AUDIO": "This recording could not be processed. Please record again.",
    "CAPACITY_UNAVAILABLE": "Another recording is still being processed. Please try again shortly.",
    "PRONUNCIATION_ATTEMPT_CONFLICT": "This attempt cannot be reused. Please start a new recording.",
    "AZURE_TIMEOUT": "The assessment took too long. Please try again shortly.",
    "AZURE_RATE_LIMIT": "The assessment service is busy. Please try again shortly.",
    "AZURE_UNAVAILABLE": "The assessment service is unavailable. Please try again later.",
    "AZURE_CREDENTIALS_INVALID": "The assessment service is not configured correctly.",
    "AZURE_CONFIG_MISSING": "The assessment service is not configured correctly.",
    "CONVERTER_UNAVAILABLE": "The assessment service is not configured correctly.",
    "PROVIDER_CONFIG_UNSUPPORTED": "The assessment service is not configured correctly.",
    "PROVIDER_RESPONSE_INVALID": "The assessment service returned an unexpected response.",
    "CONVERTER_INTEGRATION_ERROR": "The assessment service could not process this recording.",
    "PROCESSING_INTERRUPTED": "Processing was interrupted. Please try again.",
    "PROVIDER_OUTCOME_UNKNOWN": "The assessment outcome is not yet available. Please check again.",
    "AZURE_RECOGNITION_ERROR": "The recording could not be assessed. Please try again.",
    "NO_MATCH": "The recording could not be understood. Please record again.",
    "INITIAL_SILENCE": "Nothing was heard. Please record again.",
    "BABBLE": "The recording was unclear. Please record again.",
    "TARGET_OMITTED": "Some of the practice text was not read. Please record again.",
    "TARGET_EVIDENCE_INSUFFICIENT": "The practice text could not be verified. Please record again.",
}
DEFAULT_DETAIL = "Pronunciation assessment could not be completed."


def _safe_detail(code: str | None) -> str:
    return SAFE_DETAILS.get(code or "", DEFAULT_DETAIL)


def _envelope(
    status_code: int,
    code: str,
    category: str,
    detail: str,
    result=None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": detail,
            "code": code,
            "category": category,
            "result": None if result is None else result.model_dump(mode="python"),
        },
    )


class _UploadError(Exception):
    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.detail = detail


async def _read_attempt_payload(
    request: Request,
) -> tuple[bytes, PronunciationAttemptMetadata]:
    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("multipart/form-data"):
        raise _UploadError(422, "INVALID_METADATA", _safe_detail("INVALID_METADATA"))
    content_length = request.headers.get("content-length")
    if (
        content_length
        and content_length.isdigit()
        and int(content_length) > MAX_BODY_BYTES
    ):
        raise _UploadError(413, "UPLOAD_LIMIT", _safe_detail("UPLOAD_LIMIT"))

    async def bounded_stream():
        total = 0
        async for chunk in request.stream():
            total += len(chunk)
            if total > MAX_BODY_BYTES:
                raise _UploadError(413, "UPLOAD_LIMIT", _safe_detail("UPLOAD_LIMIT"))
            if chunk:
                yield chunk

    parser = MultiPartParser(
        request.headers,
        bounded_stream(),
        max_files=8,
        max_fields=8,
        max_part_size=MAX_BODY_BYTES,
    )
    try:
        form = await parser.parse()
    except Exception as exc:
        for file in parser._files_to_close_on_error:
            file.close()
        if isinstance(exc, _UploadError):
            raise
        if not isinstance(exc, (MultiPartException, ValueError)):
            raise
        raise _UploadError(
            422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
        ) from exc

    try:
        keys = [key for key, _ in form.multi_items()]
        if len(keys) != len(set(keys)) or set(keys) != EXPECTED_PARTS:
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            )

        try:
            metadata_value = form["metadata"]
        except KeyError as exc:
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            ) from exc
        if isinstance(metadata_value, UploadFile):
            metadata_bytes = await metadata_value.read()
            await metadata_value.close()
        elif isinstance(metadata_value, str):
            metadata_bytes = metadata_value.encode("utf-8")
        else:
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            )
        if len(metadata_bytes) > MAX_METADATA_BYTES:
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            )
        try:
            metadata_data = json.loads(metadata_bytes.decode("utf-8"))
            metadata = PronunciationAttemptMetadata.model_validate(metadata_data)
        except (UnicodeDecodeError, ValueError, ValidationError) as exc:
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            ) from exc

        audio_value = form["audio"]
        if not isinstance(audio_value, UploadFile):
            raise _UploadError(
                422, "INVALID_METADATA", _safe_detail("INVALID_METADATA")
            )
        try:
            audio_bytes = await audio_value.read()
        finally:
            await audio_value.close()
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise _UploadError(413, "UPLOAD_LIMIT", _safe_detail("UPLOAD_LIMIT"))
        if not audio_bytes:
            raise _UploadError(422, "EMPTY_RECORDING", _safe_detail("EMPTY_RECORDING"))
        return audio_bytes, metadata
    finally:
        await form.close()


@router.post("/attempts")
async def submit_pronunciation_attempt(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        audio_bytes, metadata = await _read_attempt_payload(request)
        kind, http_status, response = await run_in_threadpool(
            service.process_attempt,
            db,
            current_user,
            metadata,
            audio_bytes,
            ffmpeg_path=settings.ffmpeg_path,
            ffprobe_path=settings.ffprobe_path,
            azure_endpoint=settings.azure_speech_endpoint,
            azure_key=settings.azure_speech_key,
            azure_region=settings.azure_speech_region,
            temp_root=settings.pronunciation_temp_root or None,
        )
    except service.PronunciationError as exc:
        return _envelope(exc.status_code, exc.code, exc.category, exc.detail)
    except _UploadError as exc:
        return _envelope(exc.status_code, exc.code, "USER_CORRECTABLE", exc.detail)
    if kind == "failed" and response.reason is not None:
        return _envelope(
            http_status,
            response.reason.code,
            response.reason.category,
            _safe_detail(response.reason.code),
            result=response,
        )
    return JSONResponse(
        status_code=http_status, content=response.model_dump(mode="python")
    )


@router.get("/attempts/by-client/{client_pronunciation_attempt_id}")
def get_pronunciation_attempt(
    client_pronunciation_attempt_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    response = service.get_attempt_response(
        db, current_user, client_pronunciation_attempt_id
    )
    status = 202 if response.status == "processing" else 200
    return JSONResponse(status_code=status, content=response.model_dump(mode="python"))
