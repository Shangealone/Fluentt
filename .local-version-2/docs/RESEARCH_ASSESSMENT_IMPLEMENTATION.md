# Track 1 research assessments

2026-11-05. Backend development workflow implemented; final research instrument and live use BLOCKED.

## Frozen development policy

An authorized setup explicitly supplies an instrument version, pretest local date, multiple_choice or typed_recall format, and development-objective-complete-v1. The pretest date must precede intervention start. Setup pins the published pack's complete 1–200-card snapshot, item UUIDs/content versions, checking version, FSRS identity and policy. Identical setup replays; changes require a new study version.

This is a configurable test interface, not a scientifically approved instrument: all pinned items, authored order, same pool across assessments, one attempt, no retake, all responses required, one point per correct item, no penalty/partial credit, and delayed assessment does not require completed posttest. The pretest is required before later assessments/practice. No final assessment length, equivalence, validity or approved grading policy is inferred.

Existing vocabulary checking is reused, without changing classroom grading: exact MC option IDs; typed recall NFC + outer trim + casefold against explicitly authored accepted forms. Accents/internal spaces remain significant. Checking identity vocabulary-nfc-trim-casefold-v1 is recorded. Raw submitted Unicode responses are retained, not replaced by normalized text.

## Windows and records

Server UTC time and configured IANA timezone define [local midnight, next local midnight). Pretest uses its explicit date; posttest uses designated date; delayed uses the foundation's fixed posttest reference + seven calendar days, not actual submission time. No client clock input. Early/late starts/submissions fail; finalization rechecks close after processing.

Start snapshots private keys server-side, records time and exposes only public prompts/options. Explicit full-draft save uses expected_revision; restart reloads saved answers. Invalid MC IDs, unknown item identities, malformed text, assessment recall ratings and incomplete final snapshots are rejected. Subjective practice ratings never become assessment points.

Finalization records immutable responses, scoring outcomes, versioned policy, totals and time in one transaction. Final records and pinned snapshots have database guards. Natural attempt uniqueness disallows retakes; request UUID plus exact fingerprint provides replay without another score. Other edits/retries conflict. Learner receipt contains totals/time only, no key or item-answer review. Admin/instructor task monitoring does not return raw answers or score comparisons.

Missing expired assessments are classified on authorized status reconciliation with append-only events; no background job was added. Partial drafts remain intact and are marked missed_incomplete. A missing pretest does not hide an expired later assessment: its event records prerequisite_incomplete. Missing data never creates a score or zero-valued attempt.

## Evidence and limitations

Tests cover saved draft/reload, correct and incorrect MC/typed outcomes, normalization boundaries, stale revisions, invalid/incomplete payloads, same-body final replay, future/delayed windows, missed/partial status, ownership and SQL immutability. See CLASS_LEARNING_TEST_RESULTS.md for counts.

No scientific validity, reliability, learning effect or participant result is claimed. Approval still needed for item selection/length, format equivalence, retakes/accommodations, window changes, baseline prerequisites, delayed missed-posttest handling, release/correction policy and missing-data analysis.
