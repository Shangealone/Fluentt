import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.v1.router import router
from app.core.config import Settings
from app.db.engine import build_engine
from app.db.session import session_factory
from app.core.rate_limit import IdentityRateLimiter
from app.core.usernames import UsernameValidationError
from app.modules.identity.errors import IdentityError

logger = logging.getLogger("fluentt.api")


def create_app(settings: Settings | None = None) -> CORSMiddleware:
    settings = settings or Settings()
    logging.basicConfig(level=settings.log_level, format="%(levelname)s %(name)s %(message)s")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.engine = build_engine(settings)
        app.state.session_factory = session_factory(app.state.engine) if app.state.engine is not None else None
        logger.info("application_started database_configured=%s", app.state.engine is not None)
        try:
            yield
        finally:
            if app.state.engine is not None:
                app.state.engine.dispose()
            logger.info("application_stopped")

    app = FastAPI(
        title="FLUENTT API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.identity_limiter = IdentityRateLimiter(settings.identity_rate_window_seconds)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        if request.url.path.startswith(
            (
                "/api/v1/users",
                "/api/v1/usernames",
                "/api/v1/sessions",
                "/api/v1/classes",
                "/api/v1/class-enrollment-previews",
                "/api/v1/class-memberships",
                "/api/v1/admin",
                "/api/v1/curriculum",
                "/api/v1/lessons",
                "/api/v1/assignments",
                "/api/v1/me/",
                "/api/v1/instructor/",
                "/api/v1/communication/",
            )
        ):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        logger.info("request_completed request_id=%s status=%s", request.state.request_id, response.status_code)
        return response

    def error(request: Request, status: int, code: str, message: str, details=None, headers=None):
        request_id = getattr(request.state, "request_id", str(uuid4()))
        safe_headers = {**(headers or {}), "X-Request-ID": request_id}
        if request.url.path.startswith(
            (
                "/api/v1/users",
                "/api/v1/usernames",
                "/api/v1/sessions",
                "/api/v1/classes",
                "/api/v1/class-enrollment-previews",
                "/api/v1/class-memberships",
                "/api/v1/admin",
                "/api/v1/curriculum",
                "/api/v1/lessons",
                "/api/v1/assignments",
                "/api/v1/me/",
                "/api/v1/instructor/",
                "/api/v1/communication/",
            )
        ):
            safe_headers.update({"Cache-Control": "no-store", "Pragma": "no-cache"})
        return JSONResponse(
            status_code=status,
            content={"error": {"code": code, "message": message, "details": details, "request_id": request_id}},
            headers=safe_headers,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error(request, exc.status_code, "http_error", "Request could not be completed", headers=exc.headers)

    @app.exception_handler(IdentityError)
    async def identity_error(request: Request, exc: IdentityError):
        return error(request, exc.status, exc.code, exc.message, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        details = []
        for item in exc.errors():
            detail = {"location": list(item["loc"]), "type": item["type"]}
            validation_cause = item.get("ctx", {}).get("error")
            if isinstance(validation_cause, UsernameValidationError):
                detail["message"] = str(validation_cause)
            elif item["loc"][-1:] == ("username",):
                detail["message"] = "Use a username of 3–24 letters, numbers or underscores."
            elif item["loc"][-1:] == ("role",):
                detail["message"] = "Choose personal_student, school_student or instructor."
            details.append(detail)
        return error(request, 422, "validation_error", "Invalid request", details)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error(
            "request_failed request_id=%s exception_type=%s",
            getattr(request.state, "request_id", "unknown"),
            type(exc).__name__,
        )
        return error(request, 500, "internal_error", "An unexpected error occurred")

    app.include_router(router, prefix="/api/v1")
    # Wrap the entire app so even unhandled error responses receive CORS headers.
    return CORSMiddleware(
        app,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
        allow_credentials=False,
    )


app = create_app()
