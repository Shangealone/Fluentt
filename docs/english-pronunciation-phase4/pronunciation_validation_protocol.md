# Proposed English pronunciation validation protocol — Phase 4

**Proposal only.** Human-subject and adviser approvals, exact prompts, variant register, score target and retention policy must be fixed before collection. No participants were recruited or recorded here.

## Questions and targets

Primary local question: does the unchanged English WavLM overall prediction associate with independently rated **segmental accuracy** on fixed, short English read-aloud phrases from consenting Philippine English speakers? Secondary: how often are word/phone feedback flags judged helpful/correct against blinded expert segment notes? Distinguish association, numeric agreement, error-detection quality, usability and improvement after practice. This protocol addresses the first two only; it cannot establish learning effectiveness or academic grading validity.

## Local pilot design

- Feasibility target: approximately **12 consenting adults × 10 frozen prompts = 120 attempted clips**, subject to approved sample/recruitment plan. These are planning counts, not a powered sample-size calculation or universal standard. Record first-language/English exposure and broad variety with consent, avoiding identifiable demographic claims from tiny cells.
- Prompts should cover predeclared consonant/vowel contexts, common function words, rhotic contexts and lexical stress opportunities, with licensed/reference audio and expert-reviewed acceptable variants. Freeze all ten prompts and reference IDs before participants speak. No original Phase 1–3 pilot audio enters this local study.
- Include every enrolled speaker's attempted prompts in the denominator. `UNSCORABLE` statuses (silence, corrupt/clipped/noisy, prompt mismatch, model failure, incomplete speech without enough audible evidence) stay visible; do not replace low-quality or low-scoring attempts. A second attempt is a separate prespecified retry analysis, never silently substituted.
- Two qualified independent English pronunciation raters, blind to model scores/assignment. Use draft rubric only after orientation, practice examples not in the final test, and frozen decision manual. Capture original ratings, reasons and review flags. Predeclare consensus/adjudication process without allowing model-guided reconciliation.
- Ethics: signed adult consent for local recording, offline/backend processing, limited trained-rater access, intended study purpose and withdrawal handling; define pseudonymization, encryption/access logs, approved retention/deletion, dataset licensing and whether audio can be reused. The project has **no approved new retention policy** here; do not collect until it exists. No research enrollment by classroom code or implicit consent.

## Analysis plan to freeze before model access

Primary model endpoint: unchanged actual `overall_score` 0–100; primary human endpoint: prespecified aggregate of valid raters' segmental 0–10 ratings if reliability supports it. Pearson and tie-aware Spearman with **speaker-cluster bootstrap** interval; speaker-level plots and failure coverage. No selective exclusion based on predicted score. Report missingness by reason and speaker. Analyze flagged phones/words only where rater notes and expected reference identity are aligned; report unassessable cases, uncertain labels and reviewer disagreements. Stratified/descriptive Philippine English variant coverage is not a fairness claim without adequate n.

Agreement: exact and ±1 integer agreement, weighted κ, and suitable absolute-agreement ICC with uncertainty if feasible; describe disagreements before combining. Rater scores should never be treated as a calibrated continuous truth without support. The proposed **Pearson ≥ .60** and **MAE ≤ 1.5 on a justified common 0–10 scale**, previously discussed, remain **PROVISIONAL**, not study success rules. Expert/adviser approval, measurement-error analysis, educational consequence and independently justified conversion are missing. Do not compute MAE/RMSE by dividing model score by 10 alone. If no prevalidated mapping exists, report correlation only and leave MAE/RMSE null.

Development and evaluation speakers must be disjoint. Any lexicon/variant acceptance, score calibration or aggregation change needs a separate development group and fixed procedure before untouched evaluation. The 30 already-inspected Phase 2 recordings are diagnostic, **not** a fresh test for Phase 3/4-inspired changes. A monotone calibration may change numeric agreement but cannot prove better phoneme recognition. Estimate uncertainty by resampling speakers, not treating phones or multiple prompts from one speaker as independent.

## External dataset

Use the newly planned SpeechOcean762 speaker-disjoint cohort under `phase5_evaluation_plan.md` for another **preliminary Mandarin-L1 English** association, not Philippine English validity. Check published corpus/license and original metadata hashes, retain errors, and keep author-training overlap **UNVERIFIED** unless documentary sample/speaker evidence resolves it. Dataset experts selected canonical phone variants after hearing audio; those labels cannot be injected as a production reference oracle. External sentence accuracy 0–10 and local draft segmental rubric may differ, so never pool them as identical labels.

## Reporting

Publish counts, reference versions, all exclusions/failures, original and any development-only decisions, speaker-aware intervals, rater agreement and sensitivity, model latency/memory and permissions. Avoid p-value or grade-validity claims from a small convenience pilot. Proceed to school use only after separate consent, deployment rights, hardware, device and target-population validation review.
