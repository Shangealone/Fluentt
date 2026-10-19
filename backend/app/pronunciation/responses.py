"""Exact decimal JSON numbers, including nested pronunciation evidence."""

from datetime import datetime
from uuid import UUID

import simplejson
from fastapi.responses import JSONResponse


def _default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Unsupported response type: {type(value).__name__}")


class PronunciationJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return simplejson.dumps(
            content,
            use_decimal=True,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            default=_default,
        ).encode("utf-8")
