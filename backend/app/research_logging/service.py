import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.research_logging.models import ResearchEvent

FORBIDDEN_PAYLOAD_KEYS = {
    "password",
    "password_hash",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "jwt_secret",
}


def sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Sanitize research payloads to prevent leaking credentials or operational secrets."""
    sanitized: dict[str, Any] = {}
    for key, val in payload.items():
        key_lower = key.lower()
        if any(forbidden in key_lower for forbidden in FORBIDDEN_PAYLOAD_KEYS):
            continue
        if isinstance(val, dict):
            sanitized[key] = sanitize_payload(val)
        else:
            sanitized[key] = val
    return sanitized


def record_research_event(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
) -> ResearchEvent:
    """Append a sanitized research event to the research log."""
    clean_payload = sanitize_payload(payload)
    event = ResearchEvent(
        user_id=user_id,
        event_type=event_type,
        payload=clean_payload,
    )
    db.add(event)
    return event
