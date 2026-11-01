"""SIMULATED calendar tests: no database, actual learners or model inference."""
import hashlib
import json
from datetime import timedelta
from ml.esr_phase1.simulate import OPEN, CLOSE, POLICIES, scenarios, summary, write_outputs
from ml.esr_phase1.prototype import actionable, replay_log
import pytest


def small_grid():
    return list(scenarios(weekdays=(0,4),patterns=('cold','recent'),lateness=(0,2),deltas=(-.1,.1)))


def test_scenarios_are_deterministic_and_logs_reconstruct():
    first=small_grid();second=small_grid()
    assert first==second and len(first)==320
    assert all(row['simulated'] and replay_log(row) for row in first)
    assert all(row['fallback_reason']=='insufficient_history' for row in first if row['history_kind']=='cold')


def test_calendar_month_and_missed_day_hypotheses_are_explicit():
    assert OPEN.isoformat()=='2026-11-02T00:00:00+08:00'
    assert CLOSE.isoformat()=='2026-12-02T00:00:00+08:00'
    assert all('SIMULATED' in policy.version for policy in POLICIES[1:])
    original=POLICIES[2];missed=POLICIES[4]
    due=OPEN+timedelta(days=7,hours=9)
    assert actionable(due,original).date()!=actionable(due,missed).date()


def test_summary_separates_censoring_and_real_day_differences():
    rows=small_grid();groups=summary(rows)
    assert all(group['actionable_day_changed']<=group['comparable_both_actionable'] for group in groups)
    assert all(group['both_outside_window']+group['availability_changed']+group['comparable_both_actionable']==group['rows'] for group in groups)
    assert any(group['raw_changes_collapsed_by_rounding'] for group in groups)


def test_output_writer_never_overwrites_existing_research_artifacts(tmp_path):
    existing=tmp_path/'prior';existing.mkdir();file=existing/'unrelated.csv';file.write_text('preserve')
    with pytest.raises(FileExistsError):write_outputs(existing)
    assert file.read_text()=='preserve'


def test_importing_prototype_does_not_register_an_esr_scheduler():
    from app.modules.spaced_repetition.registry import registry
    assert registry.list_available()==['fifakt','fsrs6','sm2']
