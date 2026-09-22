from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.router import router as auth_router
from app.content.router import router as content_router
from app.database.session import get_db
from app.users.router import router as users_router

app = FastAPI(title="FLUENTT API", version="0.1.0")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(content_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
