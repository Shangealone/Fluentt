from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential as admin_credential
from app.modules.curriculum.repository import CurriculumRepository, KINDS, VIEWS
from app.modules.curriculum.schemas import BrowseQuery, Page
from app.modules.curriculum.service import browse
from app.modules.identity.dependencies import require_credential, require_secure_transport, throttle_sessions


def get_repository(session: Annotated[Session, Depends(get_session)]):
    return CurriculumRepository(session)


def get_admin_repository(session: Annotated[Session, Depends(get_session)]):
    return AdminRepository(session)


def make_router(admin=False):
    router = APIRouter(
        prefix="/admin/curriculum" if admin else "/curriculum",
        tags=["curriculum structure"],
        dependencies=[Depends(require_secure_transport)] + ([] if admin else [Depends(throttle_sessions)]),
    )
    credential = admin_credential if admin else require_credential

    def dispatch(request, repo, admin_repo, token, query, kind, **kwargs):
        return browse(
            repo, token, request.app.state.settings, query, kind, admin_repo=admin_repo if admin else None, **kwargs
        )

    def list_endpoint(kind):
        def endpoint(
            request: Request,
            query: Annotated[BrowseQuery, Query()],
            token: Annotated[str, Depends(credential)],
            repo: Annotated[CurriculumRepository, Depends(get_repository)],
            admin_repo: Annotated[AdminRepository, Depends(get_admin_repository)],
        ):
            return dispatch(request, repo, admin_repo, token, query, kind)

        return endpoint

    router.add_api_route(
        "/versions",
        list_endpoint("versions"),
        methods=["GET"],
        response_model=Page[VIEWS[0]],
        name=f"{'admin' if admin else 'mobile'}_curriculum_versions",
    )

    def detail_endpoint(kind):
        def endpoint(
            node_id: UUID,
            request: Request,
            query: Annotated[BrowseQuery, Query()],
            token: Annotated[str, Depends(credential)],
            repo: Annotated[CurriculumRepository, Depends(get_repository)],
            admin_repo: Annotated[AdminRepository, Depends(get_admin_repository)],
        ):
            return dispatch(request, repo, admin_repo, token, query, kind, node_id=node_id)

        return endpoint

    def children_endpoint(kind):
        def endpoint(
            parent_id: UUID,
            request: Request,
            query: Annotated[BrowseQuery, Query()],
            token: Annotated[str, Depends(credential)],
            repo: Annotated[CurriculumRepository, Depends(get_repository)],
            admin_repo: Annotated[AdminRepository, Depends(get_admin_repository)],
        ):
            return dispatch(request, repo, admin_repo, token, query, kind, parent_id=parent_id)

        return endpoint

    for index, kind in enumerate(KINDS):
        prefix = "admin" if admin else "mobile"
        router.add_api_route(
            f"/{kind}/{{node_id}}",
            detail_endpoint(kind),
            methods=["GET"],
            response_model=VIEWS[index],
            name=f"{prefix}_curriculum_{kind}_detail",
        )
        if index:
            router.add_api_route(
                f"/{KINDS[index - 1]}/{{parent_id}}/{kind}",
                children_endpoint(kind),
                methods=["GET"],
                response_model=Page[VIEWS[index]],
                name=f"{prefix}_curriculum_{kind}_list",
            )
    return router


router = make_router()
admin_router = make_router(admin=True)
