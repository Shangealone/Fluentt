# Experimental design audit

2026-11-05. Documentation-only audit. VERIFIED = source/artifact observation; PROPOSED = requires approval; BLOCKED = unmet prerequisite. No application/schema/configuration/participant changes. Existing uncommitted work preserved. No live database inspected; statements about behavior describe code, not actual enrollment counts.


## VERIFIED: three distinct implementation paths

1. **ESR vocabulary foundation, esr-counterbalanced-v1.** In services/api/app/modules/vocabulary_review/service.py:207,241–260, an administrator-created protocol pins two disjoint pools and participant capacity. Allocation balances mapping counts, uses secrets.choice on ties, reuses an existing allocation, then initializes item states in BOTH pools. It stores mapping 1 or 2, not a single algorithm arm. policy.py assigned_condition implements 1: A=FSRS/B=ESR; 2: A=ESR/B=FSRS. Every participant would contribute both conditions concurrently. There is no AB/BA time-period switch or washout. Calling this a temporal crossover would be misleading.
2. **Legacy group allocator.** research/experiment_service.py:632–740 has sm2_control/esr_experimental groups with hard-coded 15/15 quotas, shuffled blocks of four and stored seed/block metadata. ResearchGroup.condition in models/research.py:128 explicitly names SM-2. ensure_study_experiment_infrastructure(:362) creates SM-2 infrastructure. This is not an FSRS-6 parallel trial. Its default seed derives from study/block identifiers; that is reproducibility, not proof of concealed randomization or concurrent allocation safety. It is not automatically interchangeable with the ESR foundation.
3. **Managed research-classroom configuration.** research/classroom_service.py:181–186 validates legacy SM-2/FIFAKT condition configurations. research/execution_guard.py blocks live managed participation/reviews for research-classrooms-v1 AND esr-counterbalanced-v1. It is preparation infrastructure, not a deployed FSRS-6 experiment.

## VERIFIED: participation, histories, teaching and assessments

| Question | Source evidence and behavior |
|---|---|
| Allocation storage | models/vocabulary_review.py ESRAllocation: unique protocol/participant + mapping; ESRProtocol: two pool IDs, configuration, status/revision. Migration 0021 protects retained evidence. No random seed is stored for the secrets.choice mapping allocator. |
| Algorithm selection | vocabulary_review/service.py:410 derives condition from retained mapping+pool on finalization, not a student's choice. Existing allocation replay does not regenerate item state. |
| Memory/history | :413–439 and ESRReviewState isolate memory/due/revision by allocation/pool/item; histories use same allocation+pool, finalized before presentation. Current response excluded; next format recorded. Decisions retain condition, pool, model/hash, config fingerprint, baseline/proposed intervals. |
| Personalized questions | policy.format_for alternates multiple-choice/typed recall by authored position and revision, independent of condition. Stable pool snapshots supply public questions. Due queue uses due_at<=now, chronological/ID order, limit 50 (:360). These are not participant-level algorithm changes. |
| Periods/phases | review_view.phase is answer/rating/finished UI state, not an experimental period. No month-long intervention phases or timed algorithm switches exist in the ESR allocation model. |
| Class joining | enrollment/service.py enrolls ordinary ClassMembership using existing invitation checks. No research allocation call there. Class code is not consent, randomization or study eligibility. |
| Live eligibility | vocabulary_review/service.py:269–324 checks school role, active user/class/owner, membership, retained research identity, eligible/enrolled participant, current consent evidence and active allocation/protocol. |
| Activation | :78–110 and :241 enforce approval evidence, matching configuration, published pools, model provider and unconditional study_workflow_unavailable. Administrator permissions/class scope/CSRF and confirmations apply. Teacher class creation/joining cannot activate treatment. |
| Assessment coverage | models/research.py ResearchAssessment supports pre_test/post_test/delayed_retention, snapshots and optional windows; legacy experiment_service.py:1005 lists milestone-gated instruments and :578 creates delayed instruments. This is not a verified pool-linked ESR assessment workflow or seven-day enforcement. ESR implementation report explicitly lists that integration as missing. |
| Daily adherence | Existing presented/answered/finalized timestamps and response_elapsed_ms record encounters; they do not prove an offered daily session, a missed opportunity or 5–10 minutes of active study. No durable ESR daily-opportunity ledger exists. |

## BLOCKED conclusions

Neither current ESR mapping groups nor the legacy SM-2 groups implement the proposed FSRS-6-only versus hybrid 15/15 trial. Source does not establish any currently treated students. No intervention, seed, allocation, assessment or class was generated in this audit. Existing nine requested reports and ESR_IMPLEMENTATION.md were read; code findings supersede imprecise labels. See EXPERIMENT_CHANGE_IMPACT.md for source-level plan and THESIS1_EXPERIMENT_ALIGNMENT_SUMMARY.md for verification scope.
