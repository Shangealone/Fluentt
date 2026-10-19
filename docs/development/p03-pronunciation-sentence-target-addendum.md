# Pronunciation sentence targets and implementation repairs

Date: 19 October 2026 (Asia/Manila). Supplements the P02 pronunciation architecture/scoring specification. Applies to the development/adviser slice; the development seed is not research material.

## Targets and identity

The metadata part must explicitly contain `target_kind`, either `term` or `sentence`. Missing/unknown kinds are rejected with 422 `INVALID_METADATA` before claiming an attempt. No default target kind is inferred.

Both modes bind the vocabulary item, immutable revision and published English content release. Term mode uses the revision's `term`; sentence mode uses its `example_sentence`. Neither accepts client-provided reference text. Empty/unavailable/inconsistent targets return the safe 422 `INVALID_TARGET` envelope. The response's historical `target.term` field contains the actual reference text for either mode; `target.target_kind` disambiguates it.

The Android screen offers term/sentence practice when the example sentence exists. Changing mode cancels and deletes any previous capture. Maximum recording duration remains ten seconds; this does not authorize longer sentence recordings. The capture profile identifier remains `expo57-term-m4a-v1` for compatibility: it identifies the media format, while `target_kind` identifies what is spoken.

On successful capture finalization, freeze a client attempt UUID and UTC finalization timestamp. Submit freezes the target references and original authenticated owner before any authentication/network await. Reconciliation keeps these facts and the same cache URI; it does not mint another identity. A fresh user-initiated recording gets a fresh identity. No pronunciation record is placed in the durable review/sync queue.

## Scoring and feedback

Accuracy alone determines A (>=90), B (>=75), C (>=60), or D. Classification uses the unrounded provider Decimal. A raw 89.995 displays 90.00 but remains B; 90.00499999 is A. Display formatting uses its own decimal context, without inheriting or modifying the caller's precision/flags.

Parse provider JSON fractional numbers as Decimal. Store primary/secondary scores as unconstrained PostgreSQL NUMERIC. Persist nested evidence scores as decimal text inside JSONB; reconstruct Decimal on response. HTTP responses preserve the P02 numeric JSON contract using exact Decimal serialization, without an intermediate binary float. Mobile displays the server's display string and category, and never derives a category from JavaScript's rounded numeric value.

Scored results require feedback. Unscorable and failed results may also contain deterministic corrective/service feedback and its policy version. They contain no numeric learner-performance score or A–D category. Missing aligned target words or an Omission are unscorable, even if incidental provider values are present. Malformed optional provider scores are provider-response failures, not uncaught server exceptions.

## Lifecycle and limits

The database's per-owner partial unique index permits one processing attempt. Dispatch, terminal finalization and expiry use row locks. A completed competing terminal result wins; a same-ID replay does not dispatch again. The expiry worker runs at startup and every fifteen seconds, independently of GET polling. GET remains side-effect-free. Orphan cleanup uses the configured temporary root.

Multipart rejection closes all parsed files, including duplicate/unexpected parts. Provider responses are consumed as a bounded stream. Converter stdout/stderr are drained with limits while the process runs; timeouts/overflow terminate and reap the process. ffmpeg also receives a bounded output-file size. Decoded duration excess is a user-correctable duration error.

Captured audio stays in cache while awaiting submit or resolving an uncertain response. Delete it on terminal outcome, rerecord, cancellation, background/navigation cleanup, or disposal. A transport failure offers status reconciliation; only a 404 permits resending the same recording and metadata. Poll processing results every two seconds for up to twenty seconds, then retain manual checking. A forty-five-second request deadline leaves a truthful uncertain state even if the transport ignores abort. Owner changes fence delayed responses.

## Schema deployment

`p04c0de000001` now contains proper Alembic upgrade/downgrade functions. `p05c0de000001` upgrades pre-repair pronunciation result tables by removing the six-decimal storage limit and correcting the feedback constraint. Its downgrade refuses a lossy reversal. Existing stored scores already rounded by a previous schema cannot have their lost digits recovered by this migration.

Use `alembic upgrade head` for application databases. Test fixtures also apply the repair to explicitly isolated persistent test databases. The historical D5 downgrade test temporarily removes empty later pronunciation tables inside a rollbackable savepoint before exercising the older boundary.

## Verification boundary

Automated checks cover mocked-provider multipart/API flows, exact decimal persistence/replay, concurrent claims and overlapping replay, scheduler/research table digests and scheduler spies, capture cleanup, mobile result states and owner fencing, transport deadlines, and real ffmpeg AAC-to-PCM conversion using generated audio.

These checks do not prove physical-device capture or Azure scoring feasibility. Azure credentials, an authorized Android device and a real spoken recording are still required. See the updated progress audit for actual run results and remaining gates.

Implementation references: [Expo SDK 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/), [FFmpeg Windows build sources](https://ffmpeg.org/download.html), and the existing P02 specification.
