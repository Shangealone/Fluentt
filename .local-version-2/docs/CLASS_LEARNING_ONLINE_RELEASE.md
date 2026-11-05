# Class Learning online release
Date: 2026-11-05. Status: IN PROGRESS — database transaction and Render release verification pending.

## Authorized scope
The user requested the current version-5-based Class Learning feature online using the existing Supabase team-test accounts. This authorizes the necessary reviewed database/content upgrade and online release. Research participation, validated hybrid treatment, paid hosting, new speech checkpoints and grade fabrication are excluded.

## Destination and code
- Team URL: https://fluentt-team-demo.onrender.com/
- Render service: srv-dbkguqec6qcc73fq0040; existing Singapore Free service, not the synthetic staging service.
- Connected repository: https://github.com/Shangealone/Fluentt
- Release branch: codex/class-learning-online
- Correct app root: .local-version-2
- Build: bash scripts/build-render-staging.sh
- Start: bash scripts/start-render-team-demo.sh
- Saved Kaiser version-8 remains unchanged; release commits use a new branch in the repository already connected to Render.
- Source baseline 81f3f54; release changes include school-only welcome/signup, the no-grade teacher-form regression, explicit research/personal-signup exclusions in the team launcher, and blueprint root configuration.

## Database protection and rehearsal
Read-only inventory found revision 0018_personal_history, 5 users, 1 class, 1 membership, 0 lessons/assignments/research participants and no anon/authenticated direct table grants.

Automatic approval review initially rejected exporting account/history records without explicit approval for the payload and local destination. The user subsequently explicitly approved that private local backup. Backup and rehearsal then proceeded; no export occurred before that approval.

The custom-format FLUENTT app-schema backup is 405864 bytes; SHA-256 57c54f80625de798044788276651898c0de35b65ed2260429e894c410f130e08. It covers public and research_private application schemas, including records and guards; it is not a full backup of Supabase Auth/Storage or platform configuration. It stays only under ignored private-data/class-online-release and is not committed or uploaded to GitHub.

Restored a fresh local copy and upgraded normally from 0018 to 0027, without initial bootstrap repair or stamping. All existing record projections across 71 tables were unchanged before content import. The existing content-only importer succeeded with 45 administrator lessons and 371 question revisions, preserving the bundle lifecycle/private-key rules and natural reference-ID mappings. Bundle SHA-256: 3058ebab7b9d9b8cfbeb3f0910df669306f1322efae3779e9880cd3eb8193c57.

Production apply uses one explicit operator transaction with exact project/revision checks, backup/hash verification, bounded statement/lock waits, app write locks, preserved-column/row checks and direct-client-grant refusal. It is not automatic startup migration. No accounts, class codes or history are replaced or reassigned.

The ordinary library CLI remains development-only. This release uses an explicit, private, owner-authorized operator procedure against the pinned team-test destination after successful restore rehearsal; the application does not acquire a public content-import endpoint or migration-on-start.

## Verification completed before live release
- 24 targeted backend/PostgreSQL checks passed: registration, merge safety, deployment guard, library round-trip/conflict handling, no-grade class/lesson sharing, external proficiency and private instructor questions.
- One initial test still expected version-5 head 0025; updated its assertion to the actual 0027 head. A transient indentation error during that edit was corrected. Final selection passed.
- Local Expo production web export passed.
- All 45 exported JavaScript assets served successfully through the FastAPI static route. Teacher SPA route and health returned 200.
- Exported assets contained no local preview API URL; production uses the same HTTPS origin.
- Latest mobile entry/form suite: 9 passed; typecheck passed; lint 0 errors/6 retained warnings.
- Private files, configuration, model/audio resources and built assets remain ignored.

## Pending acceptance
Record the actual Supabase commit receipt, Render live commit/deploy ID, and real HTTPS checks here after they complete. Do not call the release online merely because GitHub contains the code.

## Boundaries and recovery
Both research flags and new personal signup are explicitly off in the team startup script. WavLM/MMS settings and AI Tutor secrets/allowlist are not broadened by this release. Free Render speech inference remains unavailable unless separately provisioned safely; no fake score is substituted.

The static learner/instructor app is deployed with the API. This does not deploy the separate Next administrator website or rebuild the Android APK. Old APK installations do not receive the new UI simply because the server is updated.

Keep account/session identifiers, private keys, passwords, connection URLs and backup contents out of logs/public reports. Do not automatically downgrade occupied schemas or restore over current data. A recovery restore requires a separately reviewed plan and explicit authorization; prefer correcting a verified application defect while retaining the additive data history.
