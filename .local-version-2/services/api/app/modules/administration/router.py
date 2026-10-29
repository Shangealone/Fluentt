from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.administration import service
from app.modules.administration.oidc import OIDCProvider
from app.modules.administration.repository import AdminRepository
from app.modules.administration.security import denied, valid
from app.modules.identity.dependencies import require_secure_transport, throttle
from app.modules.identity.errors import IdentityError

router = APIRouter(
    prefix="/admin", tags=["administrator authentication"], dependencies=[Depends(require_secure_transport)]
)


def cookie_name(settings, kind="session"):
    prefix = "__Host-" if settings.environment == "production" else ""
    return prefix + ("fluentt_admin" if kind == "session" else "fluentt_oidc")


def set_cookie(response, settings, kind, value, max_age):
    response.set_cookie(
        cookie_name(settings, kind),
        value,
        max_age=max_age,
        path="/",
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
    )


def request_id(request):
    return UUID(request.state.request_id)


def origin_required(request: Request):
    if (
        request.headers.get("origin") != request.app.state.settings.admin_web_origin
        or request.headers.get("sec-fetch-site") == "cross-site"
    ):
        raise IdentityError(403, "admin_origin_rejected", "Reload the administrator website and try again.")


def throttle_auth(request: Request):
    # BFF peers share this budget. Production must enforce a client-aware global edge budget too.
    throttle(request, "admin_auth", "admin_auth_limit")


def configured(request: Request):
    if not request.app.state.settings.admin_oidc_enabled:
        raise IdentityError(503, "admin_sign_in_unavailable", "Administrator sign-in is not configured.")


def repository(session: Annotated[Session, Depends(get_session)]):
    return AdminRepository(session)


def provider(request: Request):
    return OIDCProvider(request.app.state.settings)


def credential(request: Request):
    value = request.cookies.get(cookie_name(request.app.state.settings))
    if request.headers.get("authorization") or not valid(value):
        raise denied()
    return value


@router.get("/auth/config")
def configuration(request: Request):
    return {"enabled": request.app.state.settings.admin_oidc_enabled}


@router.post("/auth/start", dependencies=[Depends(origin_required), Depends(throttle_auth), Depends(configured)])
def start(
    request: Request,
    repo: Annotated[AdminRepository, Depends(repository)],
    oidc: Annotated[OIDCProvider, Depends(provider)],
):
    state, binding = service.begin_attempt(repo, request_id=request_id(request))
    try:
        location = oidc.authorization_url(state, binding)
    except Exception:
        service.login_failed(repo, "provider_unavailable", request_id(request))
        raise IdentityError(503, "admin_sign_in_unavailable", "Sign-in is unavailable. Please try again.") from None
    response = RedirectResponse(location, status_code=303)
    set_cookie(response, request.app.state.settings, "attempt", binding, 600)
    return response


@router.get("/auth/callback", dependencies=[Depends(throttle_auth), Depends(configured)])
def callback(
    request: Request,
    repo: Annotated[AdminRepository, Depends(repository)],
    oidc: Annotated[OIDCProvider, Depends(provider)],
):
    settings = request.app.state.settings
    binding = request.cookies.get(cookie_name(settings, "attempt"))
    state = request.query_params.get("state")
    code = request.query_params.get("code")
    token = None
    accepted = service.consume_attempt(repo, state, binding, request_id=request_id(request))
    if accepted:
        try:
            if (
                request.query_params.get("error")
                or not code
                or len(code) > 4096
                or any(len(request.query_params.getlist(key)) > 1 for key in ("state", "code", "error"))
                or request.query_params.get("iss", settings.admin_oidc_issuer) != settings.admin_oidc_issuer
            ):
                raise ValueError("Invalid callback")
            issuer, subject = oidc.authenticate(code, state, binding)
        except Exception:
            service.login_failed(repo, "provider_verification_failed", request_id(request))
        else:
            token = service.issue_session(
                repo,
                issuer,
                subject,
                previous=request.cookies.get(cookie_name(settings)),
                request_id=request_id(request),
            )
    response = RedirectResponse(
        settings.admin_web_origin + ("/dashboard" if token else "/login?error=sign_in_failed"), status_code=303
    )
    if accepted:
        set_cookie(response, settings, "attempt", "", 0)
    if token:
        set_cookie(response, settings, "session", token, 8 * 60 * 60)
    return response


@router.get("/me", response_model=service.AdminProfile)
def current(
    request: Request, token: Annotated[str, Depends(credential)], repo: Annotated[AdminRepository, Depends(repository)]
):
    return service.resolve_session(repo, token, request_id=request_id(request))


@router.delete("/session", status_code=204, dependencies=[Depends(origin_required)])
def logout(
    request: Request, token: Annotated[str, Depends(credential)], repo: Annotated[AdminRepository, Depends(repository)]
):
    service.resolve_session(
        repo, token, csrf=request.headers.get("x-csrf-token"), logout=True, request_id=request_id(request)
    )
    response = Response(status_code=204)
    set_cookie(response, request.app.state.settings, "session", "", 0)
    return response
