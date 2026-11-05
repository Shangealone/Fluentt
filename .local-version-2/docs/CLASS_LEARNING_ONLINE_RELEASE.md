# Class Learning online release
Date: 2026-11-05. Status: LIVE — scoped team-demo Class Learning acceptance passed. Full real-student production readiness remains unapproved.

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

## Actual database and deployment result

The Supabase transaction committed from 0018_personal_history to 0027_parallel_test_workflows. It preserved every pre-existing projected row across 71 tables, including the original 5 users, class and membership. Immediately after migration/import: users 5, classes 1, memberships 1, administrator lessons 45, assignments 0, research participants 0. Direct anon/authenticated application-table grants remained zero. New private research tables are structural only; no participation or model treatment was activated.

The pinned bundle retained 45 published administrator lessons, 37 published questions and 334 draft questions; draft questions were not promoted. Content import used existing version/lock/conflict guards, not a reset or overwrite. Its network-bound row-by-row transaction took several minutes; activity checks confirmed forward progress and no lock wait. The atomic preservation check preceded commit.

Render deploy dep-dbm8a75bedkc73bhcjvg succeeded and was marked Live. Deployed source: 3bc6dd7392ad46f2a4ae213e76757d029f7e8cea, branch codex/class-learning-online. Recorded duration: 3m 29s. Build used Python 3.12.10, Node 22.23.4, pinned pip/npm dependencies and Expo web export. The existing service remained Free. No new paid service was created. Later documentation-only commits do not change the deployed application code.

The exact team-demo startup guard separately passed against Supabase read-only at head 0027. Build/start/root settings now target the combined app, not the old root app.

## Real HTTPS acceptance

All checks below used https://fluentt-team-demo.onrender.com with server-backed sessions. Two newly created, clearly named synthetic team-test accounts and one synthetic class/reading were retained for review. No existing account/class was edited or deleted. This adds two users, one class/membership and one teacher-owned reading beyond the post-migration counts; it is not participant enrollment.

| Live operation | Actual HTTP result |
|---|---|
| Health and school-only registration options | 200 |
| Test research workflow unavailable | 404 as intended |
| Teacher browser registration | 201 |
| Class creation with Beginner proficiency and no grade field | 201; stored grade NULL |
| Teacher class directory and subject choices | 200 |
| Teacher lesson draft | 201 |
| Publish and explicitly share the synthetic reading | 200 / 200 |
| Teacher session restoration | 200 |
| Student class-code preview and school signup | 200 / 201 |
| Student membership and shared-lesson directory | 200 / 200 |
| Student reading of the shared lesson | 200 |
| Student session restoration | 200 |
| English speech capability response | 200; no model inference executed |

The public browser visibly showed Class Learning, Teach a class and Sign in without a Personal Learning signup choice. Screenshot and detailed test receipts are stored privately under private-data/class-online-release. Original account passwords were not reset; sign-in with an original user's password was not exercised because this verification used generated synthetic credentials. Original credentials/account values were covered by preservation checks.

This is a live teacher/student class-and-reading acceptance pass. It does not claim an online assignment grading/release walkthrough, device/APK acceptance, real speech/Tutor inference, external model validity or a live research experiment.

## Dependency audit follow-up

The build reported 20 npm advisories: 1 low, 16 moderate and 3 high, with 0 critical. npm audit and npm explain were run without changing packages. High-severity dependency entries were @expo/cli, node-forge and zod; the inspected paths run through Expo CLI/code-signing tooling and lint tooling. This is not a completed exploitability audit. No npm audit fix --force or SDK downgrade was applied. Review compatible dependency patches separately before broader use with real students. Raw audit output stays private. Existing backend session/data boundaries were not relaxed to deploy.

## Boundaries and recovery
Both research flags and new personal signup are explicitly off in the team startup script. WavLM/MMS settings and AI Tutor secrets/allowlist are not broadened by this release. Free Render speech inference remains unavailable unless separately provisioned safely; no fake score is substituted.

The static learner/instructor app is deployed with the API. This does not deploy the separate Next administrator website or rebuild the Android APK. Old APK installations do not receive the new UI simply because the server is updated.

Keep account/session identifiers, private keys, passwords, connection URLs and backup contents out of logs/public reports. Do not automatically downgrade occupied schemas or restore over current data. A recovery restore requires a separately reviewed plan and explicit authorization; prefer correcting a verified application defect while retaining the additive data history.
