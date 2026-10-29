"""Planning only. No attempts, clocks, grading, publication or participant data writes."""

STAGE_KINDS = {
    "pre_test": "pre_test",
    "immediate_post_test": "post_test",
    "delayed_retention_test": "delayed_retention",
}


def publication_status(config):
    """Declarations, even complete ones, never establish approval or execution readiness."""
    missing = [
        "approved_assessment_instruments_not_verified",
        "approved_timing_and_submission_rules_not_verified",
        "participant_authorization_workflow_unavailable",
        "assessment_execution_workflow_unavailable",
    ]
    plan = config.assessment_delivery_draft
    if plan is None:
        missing.append("assessment_delivery_draft_missing")
    else:
        for name in ("blueprint_policy", "difficulty_policy", "scoring_policy", "delayed_follow_up"):
            if getattr(plan, name) is None:
                missing.append("assessment_draft_missing:" + name)
        instruments = {item.assessment_id: item for item in config.assessments}
        for kind in STAGE_KINDS:
            stage = plan.stages.get(kind)
            if stage is None:
                missing.append("assessment_stage_missing:" + kind)
                continue
            for name in ("assessment_id", "maximum_attempts", "timeout_policy", "feedback_policy"):
                if getattr(stage, name) is None:
                    missing.append(f"assessment_stage_missing:{kind}:{name}")
            instrument = instruments.get(stage.assessment_id)
            if instrument and any(
                getattr(instrument, name) is None for name in ("opens_at", "closes_at", "timer_limit_seconds")
            ):
                missing.append("assessment_stage_window_or_timer_missing:" + kind)
    return {"status": "BLOCKED", "execution_available": False, "blockers": missing}
