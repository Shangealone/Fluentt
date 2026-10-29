"""Browser-only transport controls; native bearer authentication stays separate."""
import hashlib
import hmac
from datetime import datetime, timezone
from fastapi import Request, Response
from app.core.config import Settings
from app.core.security import valid_credential_format
from app.modules.identity.errors import IdentityError, invalid_session

def cookie_name(settings: Settings) -> str:
    return "__Host-fluentt_browser_session" if settings.environment == "production" else "fluentt_browser_session"

def csrf_token(raw: str, settings: Settings) -> str:
    secret = settings.mobile_web_csrf_secret
    if secret is None:
        raise IdentityError(503, "browser_auth_unavailable", "Browser sign-in is not configured.")
    return hmac.new(secret.get_secret_value().encode(), b"fluentt:browser:csrf:v1\0" + raw.encode("ascii"), hashlib.sha256).hexdigest()

def require_browser_write(request: Request) -> None:
    settings = request.app.state.settings
    if settings.mobile_web_csrf_secret is None:
        raise IdentityError(503, "browser_auth_unavailable", "Browser sign-in is not configured.")
    origin = request.headers.get("origin")
    if origin not in settings.mobile_web_origins or request.headers.get("x-fluentt-web") != "1":
        raise IdentityError(403, "browser_origin_denied", "This browser request is not allowed.")

def require_registration_preview_origin(request: Request) -> None:
    """Restrict browser previews to configured origins while allowing native clients without Origin."""
    if request.headers.get("origin") is not None or request.headers.get("x-fluentt-web") is not None:
        require_browser_write(request)

def require_json_browser_write(request: Request) -> None:
    require_browser_write(request)
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise IdentityError(415, "json_required", "Send a JSON account request.")

def browser_credential(request: Request) -> str:
    raw = request.cookies.get(cookie_name(request.app.state.settings))
    if not raw or not valid_credential_format(raw):
        raise invalid_session()
    return raw

def validate_cookie_session(request: Request, raw: str, *, mutation: bool) -> None:
    if mutation:
        require_browser_write(request)
    supplied = request.headers.get("x-csrf-token", "")
    if not supplied:
        if mutation:
            raise IdentityError(403, "csrf_failed", "Refresh your session and try again.")
        raise IdentityError(401, "browser_session_changed", "Your sign-in changed. Refresh and try again.")
    if not hmac.compare_digest(supplied, csrf_token(raw, request.app.state.settings)):
        # A shared cookie may have changed in another tab. Do not clear that other session.
        raise IdentityError(401, "browser_session_changed", "Your sign-in changed. Refresh and try again.")


def validate_cookie_csrf(request: Request, raw: str) -> None:
    validate_cookie_session(request, raw, mutation=True)

def set_browser_cookie(response: Response, raw: str, expires: datetime, settings: Settings) -> None:
    response.set_cookie(cookie_name(settings), raw, max_age=max(0, int((expires - datetime.now(timezone.utc)).total_seconds())),
        expires=expires, path="/", secure=settings.environment == "production", httponly=True, samesite="lax")

def clear_browser_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(cookie_name(settings), path="/", secure=settings.environment == "production", httponly=True, samesite="lax")
