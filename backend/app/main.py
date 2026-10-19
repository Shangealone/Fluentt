import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.analytics.router import router as analytics_router
from app.auth.router import router as auth_router
from app.content.router import router as content_router
from app.core.config import get_settings
from app.database import session as database_session
from app.database.session import get_db
from app.pronunciation.converter import cleanup_orphan_jobs
from app.pronunciation.router import router as pronunciation_router
from app.pronunciation.service import reap_expired_attempts
from app.reviews.router import router as reviews_router
from app.sync.router import router as sync_router
from app.users.router import router as users_router

logger = logging.getLogger(__name__)


def maintain_pronunciation():
    try:
        with database_session.SessionLocal() as db:
            reap_expired_attempts(db)
    except Exception:  # pragma: no cover - startup resilience
        logger.exception("Pronunciation startup reap failed")
    try:
        cleanup_orphan_jobs(get_settings().pronunciation_temp_root or None)
    except Exception:  # pragma: no cover - startup resilience
        logger.exception("Pronunciation orphan cleanup failed")


async def _maintenance_loop(stop: asyncio.Event):
    while not stop.is_set():
        await run_in_threadpool(maintain_pronunciation)
        try:
            await asyncio.wait_for(stop.wait(), timeout=15)
        except TimeoutError:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = asyncio.Event()
    await run_in_threadpool(maintain_pronunciation)
    task = asyncio.create_task(_maintenance_loop(stop))
    try:
        yield
    finally:
        stop.set()
        await task


app = FastAPI(title="FLUENTT API", version="0.1.0", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(content_router)
app.include_router(reviews_router)
app.include_router(sync_router)
app.include_router(analytics_router)
app.include_router(pronunciation_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
