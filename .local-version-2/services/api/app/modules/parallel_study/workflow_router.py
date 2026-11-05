from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Request

from app.modules.vocabulary_review.router import Admin, Token, CSRF, origin_required
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport
from .router import mutate
from .workflow_schemas import WorkflowSetup, Enrollment, Snapshot
from . import service, workflow_service


def flag_gate(request: Request):
    settings = request.app.state.settings
    if settings.environment != "test" or not settings.parallel_research_enabled or not settings.parallel_test_workflows_enabled:
        raise service.fail("Disposable-development workflows are unavailable", 404)


deps = [Depends(require_secure_transport), Depends(flag_gate)]
admin_router = APIRouter(prefix="/admin/parallel-studies", dependencies=deps)
mobile_router = APIRouter(prefix="/me/parallel-test", dependencies=deps)
instructor_router = APIRouter(prefix="/instructor/parallel-test", dependencies=deps)


@admin_router.post("/{protocol_id}/test-workflow", dependencies=[Depends(origin_required)])
def configure(protocol_id: UUID, payload: WorkflowSetup, admin: Admin, token: Token, request: Request, csrf: CSRF = None):
    return mutate(lambda: workflow_service.admin(admin, token, request.app.state.settings, action="configure",
                         protocol_id=protocol_id, payload=payload, csrf=csrf))


@admin_router.post("/{protocol_id}/test-enrollments", dependencies=[Depends(origin_required)])
def enroll(protocol_id: UUID, payload: Enrollment, admin: Admin, token: Token, request: Request, csrf: CSRF = None):
    return mutate(lambda: workflow_service.admin(admin, token, request.app.state.settings, action="enroll",
                         protocol_id=protocol_id, payload=payload, csrf=csrf))


@admin_router.get("/{protocol_id}/test-monitor")
def admin_monitor(protocol_id: UUID, admin: Admin, token: Token, request: Request):
    return mutate(lambda: workflow_service.admin(admin, token, request.app.state.settings, action="monitor", protocol_id=protocol_id))


@mobile_router.get("/studies")
def studies(repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="studies"))


@mobile_router.get("/studies/{protocol_id}")
def directory(protocol_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="directory", protocol_id=protocol_id))


@mobile_router.post("/studies/{protocol_id}/withdraw")
def withdraw(protocol_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="withdraw", protocol_id=protocol_id))


@mobile_router.post("/studies/{protocol_id}/{kind}/{target_id}/start")
def start(protocol_id: UUID, kind: Literal["assessment", "activity"], target_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="start", protocol_id=protocol_id, kind=kind, target_id=target_id))


@mobile_router.get("/studies/{protocol_id}/attempts/{attempt_id}")
def attempt(protocol_id: UUID, attempt_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="read", protocol_id=protocol_id, target_id=attempt_id))


@mobile_router.post("/studies/{protocol_id}/attempts/{attempt_id}/{action}")
def save(protocol_id: UUID, attempt_id: UUID, action: Literal["save", "submit"], payload: Snapshot,
         repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action=action, payload=payload,
                         protocol_id=protocol_id, target_id=attempt_id))


@instructor_router.get("/studies")
def instructor_studies(repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="instructor_studies"))


@instructor_router.get("/{protocol_id}")
def instructor_monitor(protocol_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="monitor", protocol_id=protocol_id))


@instructor_router.post("/{protocol_id}/publish")
def publish(protocol_id: UUID, repo: Repo, token: Credential, settings: Config):
    return mutate(lambda: workflow_service.mobile(repo, token, settings, action="publish", protocol_id=protocol_id))
