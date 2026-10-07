# D8 — Research timing hardening

Authority: `docs/research/fluentt-research-implementation-spec-v1.md`, section 7, and the approved D8 implementation request. D8 stops before D9/D10 and experimental schedulers. No commit is authorized.

## Audit and implementation plan

Pre-D8 inspection found `clock.now()` executed inside the initial `useRef` argument on every render, at eligibility assignment, and at next-item assignment. Assignment precedes native prompt layout. Final Correct/Incorrect reads the finish tick synchronously before account verification, request, queue insertion and navigation. Reveal only changes display state; the primary duration includes reveal and self-assessment. Save retry preserves the payload but unnecessarily reads another finish tick. There are no review-screen AppState/focus/lock handlers. Returning leaves the old start tick, so interruption time is included with no evidence. Navigating away/unmounting loses an unfinished in-memory interaction; it does not create an attempt. SQLite serialization and sync preserve D4 duration and interaction timestamp, but no timing evidence exists.

The installed React Native 0.86.3 performance implementation can itself fall back to Date.now: `Libraries/Core/setUpPerformance.js` and `src/private/webapis/performance/internals/Utilities.js`. Merely finding `performance.now` is insufficient evidence of a native monotonic source. Inspect native JSI `nativePerformanceNow`, prefer it on native, use browser performance.now on web, otherwise explicitly identify the wall-clock fallback. Choose the source once per clock, never mix epochs. Preserve nonnegative elapsed values and reject nonfinite clock readings rather than fabricate timing.

Implementation tasks (each uses deterministic failing tests before its production change):

1. Clock and per-presentation timer: source identity; single start; synchronous immutable commitment; interruption counts/reasons; no pause, restart or subtraction. Preserve a separate wall-clock commitment timestamp.
2. Canonical nullable `timing_evidence` version 1: source, presentation boundary, interruption count and unique reasons. Sanitize/copy only those fields. Add nullable authoritative ReviewAttempt JSON storage and additive online/sync responses. Legacy absence remains null; no reconstruction. Migration must preserve existing rows.
3. Native presentation adapter: keyed prompt layout followed by a frame callback while route focused, AppState active and no observed navigation transition/Android blur. Review route entry animation disabled to eliminate the initial transition ambiguity. Actions stay disabled until the presentation boundary. Next items remount at scroll origin. Focus/transition/AppState signals record evidence after start; returning never resets. Same-screen retry reuses frozen facts.
4. Replay/regression tests: real SQLite queue, backoff/auth/stale lease/lost acknowledgement; PostgreSQL acceptance/replay and migration; all D2–D7 suites. Run every requested verification command and record exact results below.

No dependencies or algorithms change. Retain `development/dev-0.1`, server eligibility, original interaction timestamps, UUID identities and ownership checks. No analytic validity claim or exclusion is inferred from clock source or interruption evidence. Native physical visibility, lock behavior, suspension clock behavior and process-termination evidence remain D10 obligations.

## Implemented operational boundaries

The review Stack route sets `animation: 'none'`. A prompt is mounted only after session resolution and fresh D7 server eligibility finish. Each item presentation has a distinct context/index/item key and remounts the ScrollView at its initial scroll position. A positive-size native `onLayout` for that prompt marks it laid out. A subsequent `requestAnimationFrame` callback starts the timer only while the route is focused, AppState is `active`, Android app blur is absent, and no observed native-stack transition is pending. Reveal/answer controls remain disabled until this callback succeeds. Layout callbacks while inactive retain layout readiness but do not read the clock; focus/resume schedules a guarded frame. Loss of readiness cancels pending frames. A stale frame cannot start another presentation.

This callback is the operational definition of visible/interactable presentation. It is an application lifecycle approximation, **not** pixel-perfect perception, a native display timestamp, or proof of when a learner first saw text. Native `onLayout` alone can precede drawing, which is why the frame and lifecycle guards are included. The review route's entry animation is disabled to avoid an unobserved initial animation; later observed transitions are gated explicitly. Initial/deep-link/nested navigation behavior still needs D10 device verification.

Reveal changes display only; it does not stop or restart the timer. The approved final commitment remains the tap on Correct or Incorrect after Reveal. The timer's `commit()` synchronously reads finish once, rounds the elapsed difference to integer milliseconds using the existing rounding convention, and freezes duration, wall-clock interaction timestamp and timing evidence before any account verification, API, storage, synchronization or navigation await. The duration continues to include reveal and self-assessment. No recall-only metric or reveal phase metric was introduced.

Harmless renders, repeat layout notifications, resume and focus restoration do not reset a started timer. Final commitment closes that presentation's measurement. After commitment, lifecycle notifications do not add interruption evidence to that answer. An account-verification pause uses the same unsaved-review/save-retry UI as a storage failure, retaining the already captured payload for the same owner; it does not reload eligibility. Disk/network/save retry uses the original UUID, answer, duration, timestamp and evidence. Each next item has a fresh timer and must reach its own presentation boundary. Saving the previous answer cannot contribute to the next duration.

## Clock sources and limitations

Clock selection happens once per clock instance; the reader is captured and never switches epochs mid-interaction:

| `clock_source` | Selection / meaning |
|---|---|
| `native_performance_now` | Installed native JSI `globalThis.nativePerformanceNow`. RN 0.86.3 `ReactCommon/jsitooling/react/runtime/JSRuntimeBindings.cpp` binds it to `HighResTimeStamp::now().toDOMHighResTimeStamp()`. |
| `performance_now` | On web, the browser `performance.now` function, bound once. Deterministic injected test clocks simulate this source; they are not native-device evidence. |
| `date_now_fallback` | Explicit Date.now reader when the above sources are unavailable. Native performance.now presence alone is insufficient because RN's shim can use Date.now. |

Ticks are local elapsed-clock values, never timestamps and never transmitted as wall-clock dates. The source reader rejects nonfinite values rather than fabricate duration; if start cannot read the clock, answer actions remain disabled. Reads are non-decreasing and the elapsed calculation clamps negative differences to zero. A backward wall-clock adjustment may produce zero/underestimated fallback duration; a forward jump may inflate it. The fallback label exposes that limitation without introducing an exclusion rule. Raw elapsed means the original captured, rounded nonnegative clock difference; it does not mean independently verified physical time.

`client_interaction_at` is separately captured using `new Date().toISOString()` at the final commitment. Queue creation/update/retry times and `server_acceptance_at` remain separate operational/server facts. Neither sync nor the backend rewrites the original timestamp. No clock-skew correction was implemented.

## Canonical timing evidence and interruption semantics

New screen captures include the single wire field `timing_evidence`:

```json
{
  "version": 1,
  "clock_source": "native_performance_now",
  "start_boundary": "prompt_layout_frame",
  "interruption_count": 2,
  "interruption_reasons": ["app_background", "screen_blur"]
}
```

Reasons are first-observed unique reasons; the count is the number of observed interruption transitions/notifications after start and before commitment. A signal can recur and increase the count without duplicating the reason. Different overlapping signals (for example inactive, background and navigation blur) remain distinct observations, not inferred independent physical episodes. Duplicate notifications that leave the same tracked lifecycle state unchanged are ignored. Count zero and an empty list mean **no interruption observed by these listeners**, not research-valid or uninterrupted human attention.

| Signal | Reason |
|---|---|
| AppState changes to `inactive` | `app_inactive` |
| AppState changes to `background` | `app_background` |
| Other non-active AppState changes | `app_state_unknown` |
| Android AppState `blur`, including notification shade | `app_blur` |
| Review route `blur` | `screen_blur` |
| Native-stack `transitionStart` | `navigation_transition` |
| Route `beforeRemove` | `navigation_away` |

Focus, active state, transition end and Android focus restore readiness without subtracting any time or clearing recorded evidence. If another route handler cancels removal, the same timing lifecycle can continue. Screen lock is recorded only insofar as it surfaces one of these application signals; there is no guessed lock label or unrelated device telemetry. Unmount/process termination before commitment loses the unfinished in-memory presentation and produces no accepted answer. A subsequent presentation receives a new lifecycle; D8 does not reconstruct the abandoned duration or claim durable interruption detection after a kill. Process-termination logging/retention remains an unresolved D9/D10 concern.

There is no pause/subtraction, restart, imputation, arbitrary interruption threshold, automatic attempt deletion, or analytical validity classification. Returning from background preserves both the elapsed-clock start and already observed evidence.

## Persistence, validation and replay

The mobile D4 sanitizer validates structure and copies only canonical evidence fields, stripping nested accidental extras. Queue `payload_json` stores this copy in existing SQLite storage; no SQLite schema migration is needed. Operational queue state/lease/retry changes never edit payload bytes. D3 worker replay forwards the stored original facts, without reading the clock or current lifecycle. Real SQLite tests cover transport retry, auth pause/resume, app-version change, stale-lease recovery and lost acknowledgements with D8 evidence.

Backend `TimingEvidence` validates version/source/boundary enums, nonnegative integer count, unique recognized reasons, and consistency between count/list. Both online and sync use the same request and acceptance service. `ReviewAttempt.timing_evidence` is nullable JSON, written with the attempt/schedule/current pointer/ledger/events transaction. Online responses, sync responses and new accepted-event ledger payloads carry the stored evidence. Duplicate acceptance returns the original attempt/evidence even if replay tries to change the timing facts.

Migration `d8c0de000001` follows `d7c0de000001`, adds only the nullable JSON column and performs **no** historical backfill. Existing accepted attempts and incoming pre-D8 requests without evidence remain SQL null and respond with JSON null. Existing queue rows keep their original omitted/null representation. Existing accepted ledger JSON is not rewritten. The migration downgrade refuses when captured evidence exists, to avoid silently dropping it. PostgreSQL migration tests verify preservation of historical attempt facts/current pointers/events and this refusal.

The existing `0–3,600,000 ms` check remains the mobile/backend software sanity range. Backend tests accept both bounds with interruption/fallback evidence. Structural failures and out-of-range values still fail validation; statistical unusualness, fallback source or interruption alone do not. No research exclusion threshold or eligibility recalculation is introduced.

ReviewAttempt storage is authoritative for D8 evidence. `REVIEW_ANSWERED` and `REVIEW_COMPLETED` payload schemas are unchanged: their client UUID/user or attempt reference links back to the attempt. Event-only exports omit timing evidence until D9 defines its projection/export and logging-schema policy. D8 does not redesign logging, retention, deletion or research-event meanings.

## Tests and verification

New backend tests: `tests/reviews/test_timing.py` (18 cases) and `test_timing_migration.py` (2 cases). New mobile timer tests: `src/reviews/__tests__/timing.test.ts`. Updated clock, screen and contract tests exercise loading, presentation/frame/focus/active guards, canceled pre-start frames, harmless renders, independent next-item timing, final commitment before delayed authentication/online acknowledgement, background/navigation/Android blur, post-commit freezing, disk-save retry and same-owner auth-verification retry. Existing D4 wall-clock, ownership, recovery, provenance, API and D7 eligibility assertions remain, with explicit layout/frame signals added to screen fixtures.

Observed final verification on 2026-10-07 (all commands exit 0):

| Directory | Command | Result |
|---|---|---|
| `backend` | `uv run alembic upgrade head` | Applied `d7c0de000001 -> d8c0de000001` to local development PostgreSQL. |
| `backend` | `uv run pytest -v` | **140 passed**, 2 existing deprecation warnings, 62.16 seconds. |
| `backend` | `uv run ruff check app tests scripts` | All checks passed. |
| `mobile` | `pnpm test` | **232 passed across 32 suites**, 19.99 seconds. Node SQLite experimental warnings remain. |
| `mobile` | `pnpm exec tsc --noEmit` | Passed, no diagnostics. |
| `mobile` | `pnpm lint` | 0 errors; 2 existing `src/i18n/index.ts` named-export warnings, lines 13 and 24. |
| Repository root | `git diff --check` | Passed; Git only reports existing LF-to-CRLF conversion warnings on four modified files. |
| Repository root | `git status --short` | 18 modified tracked files, 7 untracked files; no staged changes, no commit. |

Compared with the D7 checkpoint, 20 backend and 23 mobile cases were added. All prior D2 ownership/token-race, D3 recovery/retry, D4 metadata/timestamp, D5 provenance, D6 contracts and D7 eligibility/current-state tests pass. Initial regression runs demonstrated premature clock reads, absent evidence, sanitizer loss and the same-screen authentication-retry gap before their fixes. No D9, D10, Plan E, Conventional SRS or ESR implementation was started.

## Changed-file scope

Starting branch `main` was clean at `052985f` (`feat(reviews): add server-authoritative due eligibility`). D8 changes 25 files: 18 tracked modifications and 7 new files. No files are staged or committed.

Backend modified:

- `backend/app/reviews/models.py`
- `backend/app/reviews/router.py`
- `backend/app/reviews/schemas.py`
- `backend/app/reviews/service.py`
- `backend/app/sync/service.py`
- `backend/tests/conftest.py`

Mobile modified:

- `mobile/app/(app)/_layout.tsx`
- `mobile/app/(app)/review/[lessonId].tsx`
- `mobile/src/offline/__tests__/syncRecovery.test.ts`
- `mobile/src/offline/reviewQueue.ts`
- `mobile/src/reviews/__tests__/clock.test.ts`
- `mobile/src/reviews/__tests__/contracts.test.ts`
- `mobile/src/reviews/__tests__/reviewScreen.test.tsx`
- `mobile/src/reviews/clock.ts`
- `mobile/src/reviews/metadata.ts`
- `mobile/src/reviews/payload.ts`
- `mobile/src/reviews/types.ts`
- `mobile/src/testUtils/contracts.ts`

New files:

- `backend/alembic/versions/d8c0de000001_timing_evidence.py`
- `backend/tests/reviews/test_timing.py`
- `backend/tests/reviews/test_timing_migration.py`
- `docs/development/d8-research-timing.md`
- `mobile/src/reviews/__tests__/timing.test.ts`
- `mobile/src/reviews/timing.ts`
- `mobile/src/reviews/useReviewTiming.ts`

## Deliberately unresolved / D10 verification

Research decisions remain unresolved: recall/reveal metric definitions beyond the retained task, interruption treatment, pause/resume analysis, quality/exclusion rules for fallback or interrupted measurements, outliers, missing/abandoned interaction treatment, clock skew, and accepted clock behavior across OS suspension. D8 supplies evidence and does not choose those policies. D7 backend eligibility and the temporary scheduler remain unchanged.

D10 must verify iOS/Android Expo/Hermes native behavior: initial/deep-link presentation with animations disabled; layout/frame versus interactive controls; navigation gestures/cancel; notification shade; inactive/background/lock/unlock; elapsed-source behavior through suspension and clock changes; termination before/after commitment; durable SQLite restart, reconnect/auth replay, and ownership isolation. Deterministic Jest and PostgreSQL tests do not establish real-device perception, lock detection or native process-restart evidence.

API references inspected for the installed SDK: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo Router SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [React Native AppState](https://reactnative.dev/docs/appstate), [React Native View/onLayout](https://reactnative.dev/docs/view#onlayout), [native-stack events](https://reactnavigation.org/docs/native-stack-navigator/#events). Installed RN code, rather than generic API documentation, determined native clock source selection.
