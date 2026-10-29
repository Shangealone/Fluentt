from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request

from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required, request_id
from app.modules.curriculum.router import get_repository, get_admin_repository
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.management import execute
from app.modules.curriculum.management_schemas import ManageQuery, WriteRequest, PublishRequest, NodeView, ManagePage
from app.modules.identity.dependencies import require_secure_transport

router = APIRouter(
    prefix="/admin/curriculum/manage", tags=["curriculum management"], dependencies=[Depends(require_secure_transport)]
)
Repo = Annotated[CurriculumRepository, Depends(get_repository)]
Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(credential)]
Revision = Annotated[str | None, Header(alias="If-Match")]


def dispatch(request, repo, admin, token, **options):
    return execute(
        repo, admin, token, csrf=request.headers.get("x-csrf-token"), request_id=request_id(request), **options
    )


@router.get("/{kind}", response_model=ManagePage)
def listing(
    kind: str, request: Request, repo: Repo, admin: Admin, token: Token, query: Annotated[ManageQuery, Query()]
):
    return dispatch(request, repo, admin, token, action="list", kind=kind, query=query)


@router.get("/{kind}/{node_id}", response_model=NodeView)
def detail(kind: str, node_id: UUID, request: Request, repo: Repo, admin: Admin, token: Token):
    return dispatch(request, repo, admin, token, action="detail", kind=kind, node_id=node_id)


@router.post("/{kind}", response_model=NodeView, status_code=201, dependencies=[Depends(origin_required)])
def create(
    kind: str,
    payload: WriteRequest,
    request: Request,
    repo: Repo,
    admin: Admin,
    token: Token,
    expected: Revision = None,
):
    return dispatch(request, repo, admin, token, action="created", kind=kind, payload=payload, expected=expected)


@router.patch("/{kind}/{node_id}", response_model=NodeView, dependencies=[Depends(origin_required)])
def edit(
    kind: str,
    node_id: UUID,
    payload: WriteRequest,
    request: Request,
    repo: Repo,
    admin: Admin,
    token: Token,
    expected: Revision = None,
):
    return dispatch(
        request, repo, admin, token, action="updated", kind=kind, node_id=node_id, payload=payload, expected=expected
    )


@router.delete("/{kind}/{node_id}", dependencies=[Depends(origin_required)])
def remove(
    kind: str, node_id: UUID, request: Request, repo: Repo, admin: Admin, token: Token, expected: Revision = None
):
    return dispatch(request, repo, admin, token, action="delete", kind=kind, node_id=node_id, expected=expected)


@router.post("/versions/{node_id}/publish", response_model=NodeView, dependencies=[Depends(origin_required)])
def publish(
    node_id: UUID,
    payload: PublishRequest,
    request: Request,
    repo: Repo,
    admin: Admin,
    token: Token,
    expected: Revision = None,
):
    return dispatch(
        request,
        repo,
        admin,
        token,
        action="publish",
        kind="versions",
        node_id=node_id,
        payload=payload,
        expected=expected,
    )


@router.post("/versions/{node_id}/retire", response_model=NodeView, dependencies=[Depends(origin_required)])
def retire(node_id: UUID, request: Request, repo: Repo, admin: Admin, token: Token, expected: Revision = None):
    return dispatch(request, repo, admin, token, action="retire", kind="versions", node_id=node_id, expected=expected)
