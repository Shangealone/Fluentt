import base64
import hashlib
import hmac
import re
import secrets

from app.modules.identity.errors import IdentityError

TOKEN = re.compile(r"[A-Za-z0-9_-]{43}", re.ASCII)


def secret() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def derived(binding: str, purpose: str) -> str:
    return base64.urlsafe_b64encode(hmac.digest(binding.encode(), purpose.encode(), "sha256")).decode().rstrip("=")


def valid(value: str | None) -> bool:
    return bool(value and TOKEN.fullmatch(value))


def denied() -> IdentityError:
    return IdentityError(401, "admin_session_invalid", "Sign in with an authorized administrator account.")
