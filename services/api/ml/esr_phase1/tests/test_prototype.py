"""Deterministic SIMULATED probabilities; no learned model/learner outcomes."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from ml.esr_phase1.prototype import (
    BaseProposal, CalendarPolicy, EventContext, FrozenProbability, PriorEvent, FAILURES,
    actionable, calendar_days, candidate, decide, decision_log, frozen, prior_events, provider_decision, replay_log,
)

UTC = timezone.utc
NOW = datetime(2026, 11, 6, 10, tzinfo=UTC)  # Friday, 18:00 Manila.


def case(days=8, sufficient=True):
    context = EventContext("SIM-event", "SIM-learner", "SIM-item", NOW-timedelta(seconds=3), NOW, sufficient)
    base = BaseProposal(NOW, days, NOW+timedelta(days=days))
    return base, context, frozen(context, .8, "fsrs-6-reference-v1")


@pytest.mark.parametrize("k,f,factor,interval", [(.2,.8,"0.75","6.00"),(.8,.8,"1.0","8.0"),
    (.9,.5,"1.20","9.60"),(0,1,"0.75","6.00"),(1,0,"1.25","10.00"),(.5,0,"1.25","10"),
    (0,.5,"0.75","6"),(0,0,"1","8"),(1,1,"1","8")])
def test_candidate_direction_extremes_and_boundaries(k,f,factor,interval):
    assert candidate(8,k,f)==(Decimal(factor),Decimal(interval))


@pytest.mark.parametrize("invalid", [float("nan"),float("inf"),float("-inf"),-.01,1.01,None,True,"0.5"])
@pytest.mark.parametrize("side", ["k","f"])
def test_invalid_probability_never_enters_formula(invalid,side):
    with pytest.raises(ValueError):
        candidate(8,invalid if side=="k" else .5,invalid if side=="f" else .5)


@pytest.mark.parametrize("interval", [-1,float("nan"),float("inf"),True,"8"])
def test_invalid_baseline_arithmetic_rejected(interval):
    with pytest.raises(ValueError):candidate(interval,.8,.7)


@pytest.mark.parametrize("interval,expected", [(0,Decimal(0)),(.25,Decimal(".3125")),
                                             (36500,Decimal("45625")),(10**50,Decimal("1.25E50"))])
def test_zero_fractional_and_unusually_large_raw_intervals(interval,expected):
    assert candidate(interval,1,0)[1]==expected


@pytest.mark.parametrize("raw,expected", [(0,1),(.1,1),(.5,1),(1.499999,1),(1.5,2),(2.5,3),
                                         (36500,36500),(45625,36500),(10**50,36500)])
def test_half_up_calendar_bounds(raw,expected):assert calendar_days(raw)==expected


def test_decimal_precision_at_exact_half_boundary():
    assert candidate(2,Decimal(".7"),Decimal(".2"))[1]==Decimal("2.50")
    assert calendar_days(candidate(2,.7,.2)[1])==3


@pytest.mark.parametrize("reason", sorted(FAILURES))
def test_every_failure_retains_exact_valid_fsrs_proposal(reason):
    base,context,f=case()
    decision=decide(base,context,None,f,reason)
    assert decision.base is base and decision.due_at==base.due_at
    assert decision.interval_days==base.interval_days and decision.factor==1
    assert decision.fallback_reason==reason and decision.p_f==Decimal(".8")


@pytest.mark.parametrize("invalid", [float("nan"),float("inf"),-.1,1.1])
def test_invalid_prediction_falls_back_without_replacing_it_with_a_number(invalid):
    base,context,f=case()
    result=decide(base,context,frozen(context,invalid),f)
    assert result.base is base and result.factor==1 and result.p_k is None
    assert result.fallback_reason=="invalid_or_misaligned_prediction"


@pytest.mark.parametrize("change", [{"event_id":"wrong"},{"learner_code":"wrong"},{"item_id":"wrong"},
    {"prediction_at":NOW},{"latest_input_at":NOW},{"latest_input_at":NOW-timedelta(seconds=3)},
    {"model_version":""}])
def test_event_snapshot_alignment_and_current_response_exclusion(change):
    base,context,f=case()
    assert decide(base,context,replace(frozen(context,.4),**change),f).factor==1


def test_cold_start_and_missing_results():
    base,context,f=case(sufficient=False)
    assert decide(base,context,frozen(context,.5),f).fallback_reason=="insufficient_history"
    assert decide(base,replace(context,history_sufficient=True),None,f).fallback_reason=="missing_prediction"
    assert decide(base,replace(context,history_sufficient=True),frozen(context,.5),None).factor==1


@pytest.mark.parametrize("exception,reason", [(TimeoutError,"timeout"),(FileNotFoundError,"missing_weights"),
                                              (RuntimeError,"exception")])
def test_provider_failure_injection(exception,reason):
    base,context,f=case()
    def fail():raise exception("Synthetic failure; no real inference")
    assert provider_decision(base,context,f,fail).fallback_reason==reason


def test_history_sorting_excludes_equal_and_future_timestamps():
    rows=[PriorEvent("later",NOW+timedelta(days=1),3,"again"),PriorEvent("equal",NOW,2,"again"),
          PriorEvent("b",NOW-timedelta(days=1),2,"good"),PriorEvent("a",NOW-timedelta(days=2),1,"hard")]
    expected=(rows[3],rows[2])
    assert prior_events(rows,NOW)==expected
    assert prior_events(reversed(rows),NOW)==expected


def policy(weekdays=(0,1,2,3,4),**changes):
    return CalendarPolicy("SIMULATED-weekdays-v1",weekdays,datetime(2026,11,1,tzinfo=UTC),
                          datetime(2026,12,1,tzinfo=UTC),**changes)


def test_friday_weekend_projection_and_time_not_earlier_than_due():
    friday=NOW
    assert actionable(friday,policy())==friday
    monday=actionable(friday+timedelta(days=1),policy())
    assert monday.weekday()==0 and monday>=friday+timedelta(days=1)
    assert actionable(friday+timedelta(days=1),policy())==actionable(friday+timedelta(days=2),policy())


def test_rounding_and_weekends_can_collapse_different_intervals():
    base,context,f=case(1)
    result=decide(base,context,frozen(context,0),f)
    assert result.raw_interval_days!=1 and result.due_at==base.due_at
    base2=BaseProposal(NOW,2,NOW+timedelta(days=2))
    result2=decide(base2,context,frozen(context,1),f)
    assert actionable(result2.due_at,policy()).date()==actionable(base2.due_at,policy()).date()


def test_window_and_skipped_day_are_explicit_scenario_rules():
    from datetime import date
    p=policy(skipped_dates=(date(2026,11,9),))
    assert actionable(NOW+timedelta(days=1),p).weekday()==1
    assert actionable(p.closes_at,p) is None
    assert actionable(p.opens_at-timedelta(days=1),p)>=p.opens_at


@pytest.mark.parametrize("kwargs", [{"weekdays":()},{"weekdays":(0,0)},{"weekdays":(7,)},
                                   {"closes_at":datetime(2026,1,1,tzinfo=UTC)}])
def test_invalid_calendar_policies(kwargs):
    p=policy()
    with pytest.raises(ValueError):replace(p,**kwargs)


def test_invalid_events_and_base_proposals():
    with pytest.raises(ValueError):EventContext("e","l","i",NOW,NOW-timedelta(seconds=1))
    with pytest.raises(ValueError):EventContext("e","l","i",NOW.replace(tzinfo=None),NOW)
    with pytest.raises(ValueError):BaseProposal(NOW,0,NOW)
    with pytest.raises(ValueError):BaseProposal(NOW,1,NOW+timedelta(days=2))


def test_complete_synthetic_log_reconstructs_decision_and_detects_tampering():
    base,context,f=case()
    log=decision_log(context,decide(base,context,frozen(context,.1),f),policy())
    assert log['simulated'] and log['evidence_type']=='SYNTHETIC SIMULATION RESULTS'
    assert replay_log(log)
    assert not replay_log(log|{'factor':'1.25'})
    assert replay_log(decision_log(context,decide(base,context,None,f,'timeout'),policy()))


def test_production_pre_response_probability_is_not_recomputed_from_updated_memory():
    from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6,calculate_retrievability,FSRS6_DEFAULT_PARAMETERS
    old=calculate_fsrs6(None,'good',NOW-timedelta(days=7)).resulting_state
    elapsed=(NOW-datetime.fromisoformat(old['last_reviewed_at'])).total_seconds()/86400
    p_f=calculate_retrievability(elapsed,old['stability'],FSRS6_DEFAULT_PARAMETERS[20])
    new=calculate_fsrs6(old,'again',NOW)
    assert p_f<1 and new.resulting_state['retrievability']==round(p_f,4)
    assert calculate_retrievability(0,new.resulting_state['stability'],FSRS6_DEFAULT_PARAMETERS[20])==1


def test_existing_simulation_demonstrates_current_response_dependency_not_official_fifakt():
    from uuid import UUID
    from app.modules.spaced_repetition.fifakt import calculate_fifakt_esr
    from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6
    old=calculate_fsrs6(None,'good',NOW-timedelta(days=3)).resulting_state
    # Same pre-history, different observed current ratings -> different simulated pK.
    low=calculate_fifakt_esr(old,'again',NOW,vocabulary_item_id=UUID(int=1)).resulting_state
    high=calculate_fifakt_esr(old,'easy',NOW,vocabulary_item_id=UUID(int=1)).resulting_state
    assert low['simulated'] and high['simulated']
    assert low['fifakt_predicted_retrievability']!=high['fifakt_predicted_retrievability']
