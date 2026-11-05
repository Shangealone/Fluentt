# Track 1 Class Learning activity execution

2026-11-05. Development control execution implemented; experimental treatment blocked.

Existing one-calendar-month weekday opportunities are reused unchanged: month-end clamp/next-month exclusive boundary, Monday–Friday, IANA-local [00:00, next 00:00), approximately 5–10 expected minutes metadata. No forced timer or assertion that actual duration meets that expectation.

The owning instructor explicitly confirms publication of the frozen common vocabulary activity pool. Publication is retained/idempotent and cannot override approvals, membership, allocation or model guards. The same content objectives/pool are pinned across conditions; only real control execution is currently permitted. Future activities are locked, baseline and publication prerequisites are explicit.

Control start selects actually due per-allocation/item/version memory states and reuses existing vocabulary format rotation/public components. If nothing is due for the day, no_due_items is returned; if due later that day, not_due_yet is returned. No empty activity is fabricated. Due dates/actual intervals are retained exactly; the availability window does not rewrite the scheduler.

A persisted start event plus immutable item snapshot records content exposure at attempt opening. It does not establish that every rendered prompt was read or understood; fine-grained view/dwell telemetry is NOT IMPLEMENTED. Explicit answer/rating draft saves resume across sessions. Finalization requires every due snapshot item and distinct subjective recall rating; the server checks responses and computes effective ratings using the existing policy.

Each submitted control activity records actual objective outcomes separately from raw/effective recall ratings, original response text, server times, scheduler identity/parameters, prior/resulting intervals, memory state and due dates. FSRS state is separate from legacy/counterbalanced/Personal state.

Completed activities remain completed after the window; exact retained finalization retries remain safe. Expired eligible incomplete/unstarted work is recorded on authorized directory/monitor reconciliation. Past due eligibility reconstructs retained decisions rather than using future memory to rewrite missingness. Unpublished/baseline-blocked/model-blocked work stays explicitly blocked, not falsely completed or scored zero.

Hybrid assignment remains immutable, but start returns blocked_model before any activity attempt or state update. Standalone control is never substituted under an ESR label. No model load, new mock observations, live hybrid adapter, comparison or export.

Tests cover first and subsequent real FSRS calculations, incorrect-answer effective again, learner-specific memory, completed receipts, save/submit idempotence, windows, partial/missed status and experimental rejection. Backend network retry plumbing is verified; physical Android restart/interruption, screen-reader and responsive device acceptance remain UNVERIFIED. No mobile offline cache/submission is introduced.
