from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query as HttpQuery
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.progress.schemas import Summary, Classes, History, Query, HistoryQuery
from app.modules.progress.pathway_schemas import Pathway
from app.modules.progress.service import execute
from app.modules.progress.pathway_service import compute_pathway

router = APIRouter(
    prefix="/me",
    tags=["student progress"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/progress", response_model=Summary)
def summary(repo: Repo, credential: Credential, settings: Config, class_id: UUID | None = None):
    return execute(repo, credential, settings, action="summary", class_id=class_id)


@router.get("/progress/classes", response_model=Classes)
def classes(repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, HttpQuery()]):
    return execute(repo, credential, settings, action="classes", query=query)


@router.get("/learning-history", response_model=History)
def history(repo: Repo, credential: Credential, settings: Config, query: Annotated[HistoryQuery, HttpQuery()]):
    return execute(repo, credential, settings, action="history", query=query)


@router.get("/pathway", response_model=Pathway)
def pathway(repo: Repo, credential: Credential, settings: Config, class_id: UUID | None = None):
    return compute_pathway(repo, credential, settings, class_id=class_id)

