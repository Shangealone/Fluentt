import re
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.research_logging.models import ResearchEvent

CURRENT_RESEARCH_SCHEMA = "review-events-1"
ReviewEventType = Literal["REVIEW_ANSWERED", "REVIEW_SCHEDULED"]
FORBIDDEN_KEY_FRAGMENTS = (
    "password",
    "token",
    "secret",
    "jwt",
    "authorization",
    "cookie",
    "email",
    "deviceid",
    "deviceidentifier",
    "hardwareid",
    "advertisingid",
    "imei",
    "imsi",
    "androidid",
    "idfa",
    "idfv",
    "macaddress",
    "ipaddress",
)
FORBIDDEN_IDENTIFIER_KEYS = {
    "name",
    "fullname",
    "firstname",
    "lastname",
    "displayname",
    "givenname",
    "surname",
    "username",
    "phone",
    "phonenumber",
    "telephone",
    "address",
    "postaladdress",
}


class ItemAttemptPayload(BaseModel):
    """Current payload allowlist. All original facts live in linked authoritative records."""

    model_config = ConfigDict(extra="forbid")
    scope: Literal["item_attempt"] = "item_attempt"


def sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Defense in depth for JSON dictionaries/lists, not arbitrary string-content DLP."""
    sanitized: dict[str, Any] = {}
    for key, val in payload.items():
        if not isinstance(key, str):
            raise TypeError("Research payload keys must be strings")
        normalized = re.sub(r"[^a-z0-9]", "", key.casefold())
        if normalized in FORBIDDEN_IDENTIFIER_KEYS or any(
            fragment in normalized for fragment in FORBIDDEN_KEY_FRAGMENTS
        ):
            continue
        sanitized[key] = _sanitize_value(val)
    return sanitized


def _sanitize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return sanitize_payload(value)
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise ValueError("Research payload must contain only JSON values")


def record_research_event(
    db: Session,
    user_id: uuid.UUID,
    event_type: ReviewEventType,
    payload: ItemAttemptPayload,
    review_attempt_id: uuid.UUID,
) -> ResearchEvent:
    """Stage a typed event in the caller's acceptance transaction; never commit separately."""
    if event_type not in ("REVIEW_ANSWERED", "REVIEW_SCHEDULED"):
        raise ValueError("Unsupported current review event type")
    clean_payload = sanitize_payload(
        ItemAttemptPayload.model_validate(payload).model_dump()
    )
    event = ResearchEvent(
        user_id=user_id,
        event_type=event_type,
        payload=clean_payload,
        schema_version=CURRENT_RESEARCH_SCHEMA,
        review_attempt_id=review_attempt_id,
    )
    db.add(event)
    return event
