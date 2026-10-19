# Flashcards and vocabulary foundation — Section 17

Section 21 explicitly marks valid Flashcard recall NOT APPLICABLE to objective grading, with no points or denominator contribution. A rubric name is not an executable/approved scoring policy. Malformed pinned evidence still requires review. Neither classroom capture nor internal evaluation triggers vocabulary-review events, scheduling or research. GRADING.md defines this approved boundary.

Section 20 adds an explicitly approved, separate unscored classroom assignment boundary: an owned live-authorized attempt may deliberately retrieve its pinned Flashcard back, remember reveal and save/revise recall before final submission. General question DTOs remain front-only and final access is receipt-only. Independent FlashcardPractice retains the local once-per-visit behavior below. No VocabularyReviewEvent, scheduler, latency or research data is collected. See ASSIGNMENTS.md and SECTION_20_REPORT.md; historical no-learner-API statements below describe Section 17.

## Implemented content and access

Flashcards is the tenth existing answer method, `flashcards`, not a separate question system. Question is stable identity; QuestionRevision pins lesson, learning language, prompt/directions and public `content:{cue}`. Private `answer_key:{back,scoring_rubric_version?}` and existing private explanation retain their current schema. No example/translation/pronunciation/media/vocabulary-link field is added. Authors may write plain text into supported fields without implying a curated dataset or academic verification. Repeated cue/back text is valid; IDs, not text, determine identity. Backend validates required nonblank text, relationships, extra-field rejection and the 64 KiB definition budget. Published revisions/keys stay frozen; corrections use new IDs and retirement preserves history.

The existing administrator bank/BFF supports all ten editors. Existing questions.read permits front-only preview; read+write permits the existing private-key lookup and deliberate back reveal; publishing/retirement require read+write+publish. Saved Flashcards preview rechecks the live session, fetches the matching revision's private key only for an editor and rejects stale revision markers. Public definitions never acquire back, explanation or rubric fields. Private back is held separately in client memory and excluded from front-only preview. Plain-text back reveal is an explicitly authorized practice/editor exception, not permission to disclose other methods' keys or release controlled-test feedback. Hiding text is not a cryptographic boundary: an authorized editor can inspect the private-key response.

No mobile retrieval, reveal, submission, history or review-event endpoint exists. Reusable mobile components receive separately supplied, already authorized content. Their adapters/projectors validate structure and version identity; **they do not authorize delivery**. A future server host must enforce published/unretired pinned revisions, role/context/class eligibility and approved answer-release policy. No mobile client is given administrator credentials or private-key endpoint access.

## Approved local recall experience

FlashcardFront contains revision ID, lesson ID, method, prompt, instructions and cue only. FlashcardBack is separate `{revision_id,back}` and must match the front ID. Missing/mismatched back produces an unavailable/retry state and cannot reveal or rate. Back text and rating controls are absent from initial rendering; deliberate Reveal back exposes only the supported back text. Existing private explanation and rubric metadata are not forwarded.

The user approved these optional, subjective meanings:

| Value | Meaning |
|---|---|
| again | Could not recall |
| hard | Recalled with difficulty |
| good | Recalled with some effort |
| easy | Recalled readily |

Typed response is `{method:'flashcards',answer:{recall:'again'|'hard'|'good'|'easy'}}`. A rating is permitted once per revealed card visit. It is never objective accuracy, a score, due-date calculation, mastery threshold or research outcome. The mobile host emits an optional synchronous local callback containing the pinned revision ID and response; no callback persists or transmits data by default. Same-visit repeated callbacks are guarded. There is no clock/latency measurement, points update or scheduler state transition.

FlashcardPractice preserves supplied authored order, supports bounded Previous/Next without requiring ratings and resets reveal/rating on every card visit, including returning to a previous card. Duplicate revision IDs are rejected as ambiguous input; duplicate display text with different IDs is allowed. Loading/error/empty/inactive/resetKey/deck-identity/unmount boundaries discard local state. Restart/session recovery starts fresh, not restored from storage. Confirmed exit clears local state; cancellation keeps it. An Android hardware Back listener opens the same confirmation and is removed on unmount. Future route hosts must mount within Screen for scrolling/keyboard avoidance and set active=false/unmount on blur or session loss, clear their own buffers and provide onExit navigation. No learner route is added.

## Persistence decision remains OPEN

Section 17 explicitly permits a reusable interface when general practice persistence is not approved; the user confirmed this boundary. **No general practice events are collected.** Existing vocabulary models cannot safely substitute for that policy:

- VocabularyItem independently pins lesson/language/term/meaning/version/lock; it has no approved FK to QuestionRevision.
- VocabularyReviewState requires a SchedulerConfiguration, due_at and scheduler state/revision.
- VocabularyReviewEvent requires that state/configuration, idempotency event_key, reviewed_at, rating, duration, intervals and previous/resulting scheduler snapshots. These are future scheduler/replay storage contracts, not permission to invent unscheduled intervals or collect practice telemetry.
- LearningContext separates personal/classroom identity from coded research contexts; research contexts forbid ordinary user IDs. LearnerProfile preferences and ordinary class membership are not research consent. Research consent/assent evidence lives separately in research_private.

Before a future persistence section: approve eligible learner roles/content and practice context ownership; exact question/vocabulary-version association; event types and presented/revealed/rated ordering; whether skipped/revisited cards create events; server timestamps and client-duration semantics/ranges; retry/idempotency/replay and concurrent-session rules; owner-only history permissions; retention/deletion/minor-data policy; consent boundaries; and additive migration/API design if existing tables do not fit. General practice must never silently become participant experimental records. No session ownership/history guarantees are claimed for a nonexistent event API.

## Future scheduler boundary

This foundation offers pinned card IDs, explicit reveal state and a typed self-report response, not a scheduler implementation. A future authorized service may translate approved persisted events into versioned scheduler inputs. It must own server identity/time, authorization, configuration/version snapshots and reproducible replay. Do not make the mobile callback the source of trusted identity or timing. Do not create fake scheduler configurations/intervals to satisfy current columns.

SM-2, FSRS-6, FIFAKT/ESR, decay fitting, due dates, algorithm-group allocation and research consent/enrollment/execution remain Sections 28–31/36–38 per the supplied prompt, superseding provisional roadmap numbering. No algorithm adapter executes, no personalization is promised and no experiment is run. See SECTION_17_REPORT.md for actual verification and limitations.
