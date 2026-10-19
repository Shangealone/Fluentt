from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query as QueryParams, Request

from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required, request_id
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport
from app.modules.questions.schemas import Definition, Query, Page, ItemView, RevisionPage, RevisionView, KeyView
from app.modules.questions.service import execute

router = APIRouter(prefix="/admin/questions", tags=["question bank"], dependencies=[Depends(require_secure_transport)])
Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(credential)]
Expected = Annotated[str | None, Header(alias="If-Match")]


def dispatch(request, admin, token, **options):
    return execute(admin, token, csrf=request.headers.get("x-csrf-token"), request_id=request_id(request), **options)


@router.get("", response_model=Page)
def listing(request: Request, admin: Admin, token: Token, query: Annotated[Query, QueryParams()]):
    return dispatch(request, admin, token, action="list", query=query)


@router.post("", response_model=RevisionView, status_code=201, dependencies=[Depends(origin_required)])
def create(payload: Definition, request: Request, admin: Admin, token: Token):
    return dispatch(request, admin, token, action="create", payload=payload)


@router.get("/{question_id}", response_model=ItemView)
def detail(question_id: UUID, request: Request, admin: Admin, token: Token):
    return dispatch(request, admin, token, action="detail", question_id=question_id)


@router.get("/{question_id}/revisions", response_model=RevisionPage)
def history(question_id: UUID, request: Request, admin: Admin, token: Token, query: Annotated[Query, QueryParams()]):
    # History has a fixed item context; refuse unrelated filters instead of ignoring them.
    if any(getattr(query, field) is not None for field in ("lesson_id", "method", "language", "status", "q")):
        from app.modules.identity.errors import IdentityError

        raise IdentityError(422, "invalid_question_query", "History accepts only limit and offset.")
    return dispatch(request, admin, token, action="history", question_id=question_id, query=query)


@router.post(
    "/{question_id}/revisions", response_model=RevisionView, status_code=201, dependencies=[Depends(origin_required)]
)
def new_revision(
    question_id: UUID, payload: Definition, request: Request, admin: Admin, token: Token, expected: Expected = None
):
    return dispatch(
        request, admin, token, action="new_revision", question_id=question_id, payload=payload, expected=expected
    )


@router.get("/{question_id}/revisions/{revision_id}", response_model=RevisionView)
def revision(question_id: UUID, revision_id: UUID, request: Request, admin: Admin, token: Token):
    return dispatch(request, admin, token, action="revision", question_id=question_id, revision_id=revision_id)


@router.get("/{question_id}/revisions/{revision_id}/key", response_model=KeyView)
def key(question_id: UUID, revision_id: UUID, request: Request, admin: Admin, token: Token):
    return dispatch(request, admin, token, action="key", question_id=question_id, revision_id=revision_id)


@router.put(
    "/{question_id}/revisions/{revision_id}", response_model=RevisionView, dependencies=[Depends(origin_required)]
)
def replace(
    question_id: UUID,
    revision_id: UUID,
    payload: Definition,
    request: Request,
    admin: Admin,
    token: Token,
    expected: Expected = None,
):
    return dispatch(
        request,
        admin,
        token,
        action="replace",
        question_id=question_id,
        revision_id=revision_id,
        payload=payload,
        expected=expected,
    )


@router.post(
    "/{question_id}/revisions/{revision_id}/publish",
    response_model=RevisionView,
    dependencies=[Depends(origin_required)],
)
def publish(
    question_id: UUID, revision_id: UUID, request: Request, admin: Admin, token: Token, expected: Expected = None
):
    return dispatch(
        request, admin, token, action="publish", question_id=question_id, revision_id=revision_id, expected=expected
    )


@router.post("/{question_id}/retire", response_model=ItemView, dependencies=[Depends(origin_required)])
def retire(question_id: UUID, request: Request, admin: Admin, token: Token, expected: Expected = None):
    return dispatch(request, admin, token, action="retire", question_id=question_id, expected=expected)
