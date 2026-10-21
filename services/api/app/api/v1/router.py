from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from app.modules.identity.router import router as identity_router

from app.modules.classrooms.router import router as classrooms_router
from app.modules.enrollment.router import router as enrollment_router
from app.modules.administration.router import router as administration_router
from app.modules.curriculum.router import router as curriculum_router, admin_router as admin_curriculum_router
from app.modules.curriculum.management_router import router as curriculum_management_router
from app.modules.curriculum.material_router import router as material_router
from app.modules.questions.router import router as questions_router
from app.modules.questions.practice import router as personal_practice_router
from app.modules.assignments.router import router as assignments_router
from app.modules.assignments.capture_router import router as capture_router
from app.modules.grading.router import router as grading_router
from app.modules.assignments.results_router import router as results_router
from app.modules.progress.router import router as progress_router
from app.modules.spaced_repetition.router import router as spaced_repetition_router

from app.modules.monitoring.router import router as monitoring_router

from app.modules.communications.router import router as communications_router
from app.modules.pronunciation.router import router as pronunciation_router
from app.modules.pronunciation.whole_phrase_router import router as whole_phrase_router
from app.modules.personal_history.router import router as personal_history_router
from app.modules.conversation.router import router as conversation_router
from app.modules.research.router import student_router as research_student_router, admin_router as research_admin_router
from app.modules.research.classroom_router import (
    admin_router as research_classroom_admin_router,
    mobile_router as research_classroom_mobile_router,
)

router = APIRouter()
router.include_router(personal_practice_router)
router.include_router(research_student_router)
router.include_router(research_admin_router)
router.include_router(research_classroom_admin_router)
router.include_router(research_classroom_mobile_router)
router.include_router(conversation_router)
router.include_router(material_router)
router.include_router(spaced_repetition_router)
router.include_router(pronunciation_router)
router.include_router(whole_phrase_router)
router.include_router(personal_history_router)
router.include_router(communications_router)
router.include_router(monitoring_router)
router.include_router(classrooms_router)
router.include_router(identity_router)
router.include_router(enrollment_router)
router.include_router(administration_router)
router.include_router(curriculum_router)
router.include_router(admin_curriculum_router)
router.include_router(curriculum_management_router)
router.include_router(questions_router)
router.include_router(assignments_router)
router.include_router(capture_router)
router.include_router(grading_router)
router.include_router(results_router)
router.include_router(progress_router)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["fluentt-api"] = "fluentt-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Application liveness only; does not assert database connectivity."""
    return HealthResponse()
