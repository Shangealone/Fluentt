# Curriculum foundation — Section 09

Section 11 associates question revisions with lessons and optional competencies from that same lesson. Migration 0006 prevents moving either side into an inconsistent relationship; otherwise editable competency moves can conflict when bank references exist. Item publication requires published/unretired ancestry; edition retirement preserves question/assignment history. QUESTION_BANK.md describes separate question permissions and future assignment/class constraints. Curriculum permissions alone grant no bank/key access.

## Section 10 management — current contract

Next **/curriculum** now manages real PostgreSQL structure through FastAPI. Section 09 read APIs are unchanged; earlier authoring exclusions/unavailable-PostgreSQL notes below are historical. Head remains **0005_constraint_names** with 60 tables; no Section 10 migration is needed.

Entities: versions → grades → subjects (edition links) → quarters → topics → lessons → competencies, plus global-subjects (subject definitions). Grade links use 1–12 and the established label-preserving upsert. Quarter bounds remain 1–4; sibling positions are positive/unique, not necessarily contiguous. Five research levels and learning languages remain separate.

### Access and operator grants

Read requires curriculum.read; writes require read+write; publish/retire additionally require curriculum.publish. Existing/default admins retain dashboard-only access. Explicit commands from services/api:

```powershell
.venv/Scripts/python -m app.modules.administration.cli grant-curriculum-editor --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli grant-curriculum-publisher --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli revoke-curriculum-publisher --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli revoke-curriculum-editor --username OperationsAdmin
```

Editor grants read+write; publisher grants read+publish, so publication requires both explicit roles. Prior reader commands remain. No mobile promotion or public grants exist. User locks, role-drift checks and atomic audits remain authoritative.

Every mutation requires dedicated live admin cookies, exact Origin, X-CSRF-Token and explicit backend permissions. User/session authorization, structural writes and audits share one transaction. After authentication, acquire advisory 78090001 exclusively before DML; reads use its shared form. The Next BFF allows fixed entity/UUID/method paths, bounds JSON to 32 KiB and forwards only approved cookies/Origin/CSRF/If-Match/content type, never mobile Authorization.

### Management APIs

Backend base `/api/v1/admin/curriculum/manage`, same suffix proxied at `/api/admin/curriculum/manage`:

| Method/suffix | Contract |
|---|---|
| GET /{kind} | `{items,has_more,limit,offset}`; q literal search by name/code/description where available; status only versions/topics/lessons; limit 1–100 default 25; offset 0–100000; child kinds require parent_id. |
| GET /{kind}/{id} | `{id,kind,parent_id,version_id,revision,frozen,values}`; safe structural fields only. |
| POST /{kind} | `{values,parent_id?}` with strict per-kind validation; child creation requires If-Match of parent edition; top-level creation needs no existing revision. Returns 201. |
| PATCH /{kind}/{id} | `{values,parent_id?,target_revision?}`; If-Match of current edition/definition, partial fields (grade edits supply number); moves require editable destination and target_revision. Returns 200. |
| DELETE /{kind}/{id} | If-Match; unfrozen/unreferenced single node only, no cascade. Returns `{deleted:true}`. |
| POST /versions/{id}/publish | If-Match plus `{confirmed:true,source_reference,licensing_reference,review_note}`. Strict boolean confirmation; nonempty references/notes up to 2000 characters each. |
| POST /versions/{id}/retire | If-Match; draft/published → archived. Already retired conflicts. |

Kinds are the eight collections listed above. Management responses exclude arbitrary private source JSON, answer keys, executable activities and research data. Revision is a SHA-256 fingerprint of the entire edition's structural fields/timestamps and referenced grade/subject labels; definitions use their own fingerprint. It is not an authentication token. Changes elsewhere in an edition or to shared labels invalidate an open form. Fingerprints are reused per edition inside a list transaction; full-edition hashing/global locking require profiling before large-scale authoring.

Ordering is stable by grade/quarter number, subject code, sibling position, or root creation time, then UUID. Unknown IDs/kinds give 404; invalid fields/bounds 422; missing revision 428; stale/duplicate/protected/reference/race conflict 409; invalid session 401; missing permission/Origin/CSRF 403. Outages use the existing safe 503 boundary. Collection details clear on loading/error; conflicts retain the form for review/reload.

### Lifecycle and accountability

Drafts may be assembled incrementally. Publication requires at least one full branch and no empty included parent; existing unique/FK/positive-order constraints remain. Retired child content cannot be silently republished. Prepare/flush all topic/lesson states before publishing/freezing the root in one transaction. No all-grades/all-quarters rule, academic approval role/status, invented content counts or DepEd verification is introduced.

Review attestation, source/licensing references, review note, reviewer User ID and UTC time are stored privately in version source_metadata.administrative_review. New editions remain academically unverified. These are publisher-provided references, not independent verification. Audit events record actor_id, action, entity kind/ID, occurrence time and request ID without content bodies or secrets; audit failure rolls back the domain change.

Published or historically referenced drafts cannot be rewritten. Published versions retire as a whole, cannot return to draft/unretire, and retain all original IDs for history. Remove children first only when unreferenced/unfrozen; FK restrictions preserve all lesson/activity/history links. Shared subjects referenced by classes or frozen editions cannot be edited; corrections use a new definition/code. No automatic clone, content generation or historical learner delivery is added.

### Website flow

Configured OIDC/MFA sign-in → Dashboard → Curriculum. Browse Editions or Subject definitions; search/filter/page. Traverse Grades → Subject links → Quarters → Topics → Lessons → Competencies with breadcrumbs. Labeled forms create/edit metadata and ordering; subject selection is searchable/paged. Advanced moving verifies a copied destination parent UUID before saving. Structure browsing is the safe preview, without student lesson/assessment delivery.

Eligible drafts offer single-node removal; protected content shows frozen state. Publishers enter review evidence and confirm publication. Retirement uses an explicit accessible confirmation. In-page unsaved changes prompt before navigation; browser close/reload uses beforeunload protection. Dialogs focus the safe action, support Escape and trap Tab. Loading/empty/retry/success, keyboard controls and responsive wrapping reuse existing styles. Session denial clears protected client data; visibility/pageshow/idle checks revalidate without a heartbeat. No tokens or drafts are placed in browser storage.

See SECTION_10_REPORT.md for actual tests, failures corrected and remaining provider/native/deployment limits.

Section 09 serves persistent structure and competency descriptions, not authoring or activity delivery. Runtime uses PostgreSQL only. No curriculum, educational content, progress, academic verification or study data is seeded.

## Approved structure

`CurriculumVersion → CurriculumGrade → CurriculumSubject → Quarter → CurriculumTopic → Lesson → LearningCompetency` reuses the original tables and UUIDs. Grade/subject links expose their own IDs plus global grade_level_id/subject_id. Existing bounds remain grades 1–12, quarters 1–4 and positive sibling positions; there are no invented lesson counts or difficulty/proficiency thresholds.

Filipino is a subject; tagalog is a learning language. The five approved research levels remain ResearchLevel.number 1–5 under a study with content_snapshot and protocol locks. They are not ordinary curriculum modules or replacements for quarters. No research API, identities, consent or experiment execution is exposed here.

## Access and scope

- The user approved published structure browsing for all authenticated mobile roles, including school students beyond their classes. Saved personal preferences can guide explicit filters; they are not authorization boundaries.
- Optional class context requires the owning instructor or eligible active/unended school membership, an active/unarchived class and an available instructor, matching enrollment rules. Wrong owners, missing classes and ineligible memberships share generic 404. Personal accounts cannot use class scope.
- Class reads intersect the actual class grade and explicitly configured subject with all lists and direct descendant IDs. Class language is returned as context, never converted to a subject or applied to language-neutral structure. A null class subject gives an empty version list with requires_subject=true, rather than guessing Filipino from Tagalog.
- Admin reads require an active mapped admin browser session, dashboard.view and explicitly granted curriculum.read. They may inspect draft/published/archived structure, but cannot read class context, author content, inspect private keys or access research through that permission.
- No anonymous catalog or credential fallback exists. Protected responses are no-store. Public/mobile reads require published, unarchived version ancestry; topics must also be published and lessons/competencies require a published, unarchived lesson. Admins may intentionally inspect nonpublic ancestry.

## Read API

Mobile base `/api/v1/curriculum` uses the existing mobile Bearer credential. Admin base `/api/v1/admin/curriculum` uses the dedicated cookie and live permissions. Next's `/api/admin/curriculum/...` provides fixed GET-only adapters, with no arbitrary proxy or authoring screen.

| GET suffix | Response |
|---|---|
| /versions | Version page |
| /versions/{id} | Version |
| /versions/{id}/grades | Grade-link page |
| /grades/{id} | Grade link, global grade ID/number/name |
| /grades/{id}/subjects | Subject-link page |
| /subjects/{id} | Subject link, global subject ID/code/name/description |
| /subjects/{id}/quarters | Quarter page |
| /quarters/{id} | Quarter |
| /quarters/{id}/topics | Topic page |
| /topics/{id} | Topic |
| /topics/{id}/lessons | Lesson page |
| /lessons/{id} | Lesson structure/description |
| /lessons/{id}/competencies | Competency page |
| /competencies/{id} | Competency |

Pages contain `{items, limit, offset, has_more, class_context}`. class_context is null or `{class_id, grade_level_id, subject_id, language, requires_subject}` after class authorization. Existing empty parents return empty items; missing/hidden parents and details return generic 404. There are no synthetic lessons or progress counters.

Query fields: limit default 50 (1–100), offset default 0 (0–100000), optional grade 1–12, subject_id UUID, mobile-only class_id UUID, and admin-only status draft/published/archived on versions/topics/lessons. Other nodes have no independent lifecycle filter. Unknown query fields and invalid bounds/UUIDs are rejected. Explicit filters intersect class context, never widen access. Admin status filters refer to the returned node's stored status, so a published child under a draft ancestor is still admin-only.

Stable ordering: versions by created_at descending then UUID; children by grade number, subject code, quarter number or topic/lesson/competency position, then UUID. One extra row determines has_more. A page is consistent within its transaction; offset pages across requests are not a durable snapshot when editions are published/retired. Consumers should refresh after collection changes.

Explicit DTO allowlists exclude source_metadata, prompts, answer configurations, response history, media paths, model configuration and research data. Stored verification_status and published_at are returned honestly; unverified remains unverified, and legacy missing timestamps are not fabricated. Errors follow existing envelopes: 401 invalid/expired credentials, 403 missing permission, 404 hidden/missing resource, 422 invalid filters, 503 unavailable PostgreSQL, and existing mobile throttling may return 429.

## Snapshot lifecycle and database guards

The user approved whole-version immutability. Existing draft → published → archived status is retained; archived means retired. Corrections require a new curriculum version/code and new child IDs, preserving old assignment/progress references. Current browsing hides retired versions; future authorized history resolvers must use specific historical access rules rather than globally reopening retired content.

Additive `0004_curriculum_snapshots` adds functions/triggers only. No tables, columns, seeds, backfills, frozen migration rewrites or data deletion occur. There are still 60 domain tables: the 58 original plus two Section 08 admin tables.

- New roots start as drafts. Future publishers prepare child states before publishing the root. Published children under a draft root remain invisible to mobile users. No academic completeness rule or publication API is invented.
- Publication/retirement stamp missing lifecycle timestamps for those new transitions. Existing legacy evidence is preserved. Published/retired metadata, children, parent links, ordering and referenced global grade/subject labels are frozen; published content may retire without rewriting it, and cannot return to draft or be unretired.
- Legacy draft hierarchies already referenced by assignment_versions or learner_progress are also protected against content rewrites, preserving previously assigned/completed IDs. They can move through lifecycle without changing their content. This does not authorize historical-record deletion.
- Curriculum writes acquire exclusive transaction advisory key 78090001; structural reads acquire its shared form after authentication/class validation. Assignment/progress reference insertion/deletion/lesson-link changes use the same exclusive boundary. Ordinary progress updates retaining their lesson do not acquire it.
- This coarse initial boundary permits concurrent readers and serializes structural edits. Future authoring must acquire it before row DML and use consistent authorization/lock ordering plus reviewed conflict/retry handling. It is not a scalability claim or permission to disable protections. [PostgreSQL locking reference](https://www.postgresql.org/docs/17/explicit-locking.html).
- Existing FK/RESTRICT and uniqueness/ordering checks remain authoritative. Downgrade refuses while protected curriculum exists. Runtime roles must not own schema objects, TRUNCATE or disable triggers. Existing research/private grants and guards remain unchanged.

Apply and verify the migration before use. PostgreSQL was unavailable here, so offline compilation and synthetic doubles do not prove server-side guards/races. MIGRATIONS.md records the pre-existing frozen-0001 constraint-name bootstrap blocker; an approved repair strategy is still required.

## Operator permission commands

From services/api with the existing operator DB configuration and a separately provisioned administrator:

```powershell
.venv/Scripts/python -m app.modules.administration.cli grant-curriculum-read --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli revoke-curriculum-read --username OperationsAdmin
```

These commands manage only curriculum_reader/curriculum.read. Default provisioning remains dashboard-only; no existing admin automatically gains access. Grants are idempotent, reject unexpected extra permissions on the managed role, and cannot promote mobile accounts. Revoke removes that user's managed role and fails for review if another role still grants read access. User locking, permission mutation and audit share a transaction; subsequent API reads use that same User lock and recheck current permission. Other readers/dashboard sessions remain intact. No account or actual grant was created here.

## Existing learning-content links and future gates

The new snapshot guard freezes structural rows through competencies. Independently versioned question/activity records retain their existing locks; their collection membership is not automatically a frozen lesson-body/item-set snapshot. Future assignment/content services must pin explicit item versions rather than treating all later lesson-linked records as part of an old assignment.

| Existing link | Boundary for future implementation |
|---|---|
| QuestionRevision.lesson_id; QuestionCompetency.competency_id | Preserve the ten answer methods and version/ownership/locking rules. Approve cross-lesson competency policy before question-bank authoring. No question payload/key delivery here. |
| VocabularyItem.lesson_id, language/version/locked_at | Existing versioned association; vocabulary delivery, readiness and scheduling remain later work. |
| Optional PronunciationActivity.lesson_id and ConversationTopic.lesson_id | Preserve independent language/version/lock metadata. No AI calls, execution, recordings or scoring are exposed. |
| AssignmentVersion.lesson_id, curriculum_snapshot, locked question revisions | Future writers must select an explicit edition and validate class grade/subject/language, item ownership and immutable snapshots. No implicit latest-edition choice or class-version pin is added. |
| LearnerProgress.lesson_id and context | Original IDs persist; historical access and retirement policy need explicit delivery contracts. No progress is fabricated. |
| ResearchLevel.content_snapshot and study/instrument locks | Later protocol services must pin exact version/item IDs, preserve five-level semantics and enforce consent/research permissions. curriculum.read grants none of this access. |

Open before authoring/delivery: approved sources/licensing/reviewer evidence, grade/subject/language compatibility, lesson-body format, academic publication completeness, level content/counts/thresholds, cross-lesson assessment policy, class edition selection and retired-history access. No Section 10 implementation is authorized by this document.
