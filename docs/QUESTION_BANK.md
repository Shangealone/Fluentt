# Question bank — Section 11

Section 21 uses exact assigned locked QuestionRevision/QuestionAnswerKey IDs for an approved internal objective-exact-v1 overlay. The original key grading_version remains its ungraded-v1 authoring marker; no frozen key is rewritten or replaced with a newer revision. New grading permissions allow trusted computation without granting direct question-key downloads. General/mobile bank reads remain unchanged. GRADING.md records comparisons, integrity-review states, versioning and no-release boundaries; earlier deferred-grading notes below are historical.

Section 20 authorizes delivery only through an owned school-student unscored assignment attempt pinned to an immutable Section 19 publication. It does not add mobile bank browsing or general key access. Raw partial capture has a separate validator; existing question/response/grading definitions stay unchanged. Only deliberate attempt-scoped Flashcard back reveal is approved; all other keys/rubrics remain private. ASSIGNMENTS.md defines the approved lifecycle and receipt-only final state. Earlier delivery exclusions below retain their original milestone scope.

## Section 17: Flashcards — all ten interfaces

All ten existing methods now have administrator authoring/preview and reusable unscored mobile components. Flashcards retains public cue and private back/optional rubric reference. Required prompt/lesson/language and immutable revision rules remain; no vocabulary-link/media field, migration or endpoint is added. Existing private explanation remains author metadata, not learner feedback. Read-only previews remain front-only; editors may deliberately reveal a separately fetched private back after live session/permission/version checks. Other methods' private keys remain excluded from previews.

The user approved component-only practice with separately authorized back props, authored-order navigation, optional subjective again/hard/good/easy ratings after reveal, one rating per card visit, fresh state on navigation/restoration and confirmed exit. No history, timing, scheduler update or practice-event collection is added. VOCABULARY.md defines exact DTOs, subjective semantics, OPEN persistence policy and future server/research boundaries. SECTION_17_REPORT.md records verification and Section 18 prerequisites; counts below retain historical Section 16 scope.

| Method | Backend definition/key/response | Admin authoring + preview | Unscored mobile |
|---|---|---|---|
| multiple_choice | Implemented | Section 12 | Section 12 |
| true_false | Implemented | Section 12 | Section 12 |
| identification | Implemented | Section 13 | Section 13 |
| fill_in_the_blank | Implemented | Section 13 | Section 13 |
| multiple_select | Implemented | Section 14 | Section 14 |
| flashcards | Implemented | Section 17 | Section 17 |
| error_identification | Implemented | Section 14 | Section 14 |
| word_arrangement | Implemented | Section 15 | Section 15 |
| sentence_arrangement | Implemented | Section 15 | Section 15 |
| matching_type | Implemented | Section 16 | Section 16 |

## Section 16: Matching Type and current support matrix

Matching reuses V1 `content.left/right: [{id,text}]`, minimum two entries per side, unique IDs within each side and complete private `answer_key.pairs: [{left_id,right_id}]`. Complete one-to-one coverage requires equal set sizes; targets cannot be reused. Many-to-one needs a future versioned contract. Side namespaces are separate, so the same ID may exist once on each side. Repeated labels do not imply interchangeable identities. Text-only authoring uses unchanged secured APIs, private-key permissions, draft replacement, publication, correction revisions and retirement; no endpoint, migration or dependency is added.

Approved interaction: independent authored set order without shuffling; edit/add/remove/reorder stable entries and deliberately build private associations. Removal clears affected references; text/reorder preserves ID associations. Complete keys are required to save. A warning flags mappings aligned by visible row, but semantic hints still require author review. Explicit key-free browser/mobile previews start empty and allow left-selection then right-association, review, removal and reset. Reusing a right target clears its previous owner; controls explain this behavior. Source numbers distinguish repeated labels. Ready means all items paired once, never correctness.

Mobile MatchingQuestion is controlled; UnscoredMatchingPreview resets local state on revision/resetKey/phase/inactive/unmount boundaries. Future hosts own Screen scrolling, navigation/blur/session cleanup and their attempt buffers. Complete responses use `{method:'matching_type',answer:{pairs:[{left_id,right_id}]}}`, copied in authored left order. Empty/partial buffers are unfinished; existing backend partial-draft semantics stay unchanged. No learner bank/submission endpoint or persisted attempt is exposed.

| Method | Backend definition/key/response | Admin authoring + preview | Unscored mobile |
|---|---|---|---|
| multiple_choice | Implemented | Section 12 | Section 12 |
| true_false | Implemented | Section 12 | Section 12 |
| identification | Implemented | Section 13 | Section 13 |
| fill_in_the_blank | Implemented | Section 13 | Section 13 |
| multiple_select | Implemented | Section 14 | Section 14 |
| flashcards | Implemented | Deferred | Deferred |
| error_identification | Implemented | Section 14 | Section 14 |
| word_arrangement | Implemented | Section 15 | Section 15 |
| sentence_arrangement | Implemented | Section 15 | Section 15 |
| matching_type | Implemented | Section 16 | Section 16 |

Exactly ten backend contracts and **nine** editor/mobile methods are implemented. The Section 16 prompt's “tenth” interface count conflicts with prior scope: Flashcards remains backend-only and is not silently implemented. Grading/delivery remain deferred. SECTION_16_REPORT.md records verification and Section 17 prerequisites; older counts below are historical milestones.

## Section 15: Word and Sentence Arrangement

The existing protected **/questions** editor/BFF now supports eight methods, adding word_arrangement and sentence_arrangement through unchanged V1 backend APIs. Both use public `content.items: [{id,text}]` with at least two nonblank units and distinct stable IDs; private `answer_key.ordered_ids` must be a complete permutation of every item ID. Repeated words/sentences are valid with different IDs. Authors enter explicit whole word/token or sentence units; there is no automatic splitting, Unicode normalization, grading or alternative-order interpretation.

**Approved sequencing policy:** public item order is author-defined and edited independently of the private expected sequence. No automatic shuffle/seed policy is added. The private sequence builder starts empty for new drafts and requires every ID exactly once; public reorder/text edits retain its ID associations, and removing a unit removes its private reference. The editor warns authors if presentation order matches the private expected order, since visible content itself can give an unwanted hint. Safe previews project items only, never ordered_ids/key/explanation, and never compare local sequences with a key. This is data separation, not an automated guarantee that authored text/order cannot imply an answer.

Unscored browser and Expo **ArrangementQuestion/UnscoredArrangementPreview** start with an empty sequence. Tap a labeled source unit to append it once, move selected units earlier/later, remove units back to the available bank, review the numbered sequence or reset. Source unit numbers distinguish identical labels; text wraps and is never sliced. Tap/keyboard/button interactions reuse existing components without a new drag dependency. Missing/duplicate/unknown IDs cannot become ready. Every complete permutation is structurally ready, including reverse order, without a correctness or score claim. Typed complete payloads are `{method:'word_arrangement',answer:{ordered_token_ids:[...]}}` and `{method:'sentence_arrangement',answer:{ordered_sentence_ids:[...]}}`. ID arrays retain the learner's sequence and are copied when emitted. Partial buffers are local; existing backend partial-draft validation remains compatible and is not an authorized submission API.

Existing loading/error/retry/empty/inactive/reset/revision boundaries, permissions, dedicated sessions, Origin/CSRF, If-Match, ambiguous-save reconciliation, publication locks and history apply unchanged. Future mobile hosts must use Screen for scroll/keyboard avoidance and own blur/session/attempt cleanup. No route, learner bank/delivery/response API, migration, dependency, real content or grading is added. See SECTION_15_REPORT.md for verification, limitations and Section 16 readiness. Earlier section descriptions below are historical milestones.

## Section 14: Multiple Select and Error Identification

The protected **/questions** editor and fixed BFF now support six methods, adding multiple_select and error_identification. Existing questions.read/write/publish grants, editor-only keys, Origin/CSRF, live backend authorization, If-Match, immutable publication, correction revisions and whole-item retirement apply unchanged. No endpoint, migration, permission, dependency, learner retrieval/submission API or grader is added. Earlier section summaries below describe their milestone scope.

**Approved Multiple Select contract:** content.options contains at least two nonblank {id,text} entries with distinct stable IDs. Private correct_option_ids contains one or more distinct existing IDs; one correct option remains valid. There is no configured public minimum/maximum, count hint or scoring rule. Preview selections range from zero (unfinished) to all available options. Toggles are independent and serialize option_ids in content order, regardless of tap order. Existing backend partial-response validation remains unchanged; no completed-attempt claim is made.

**Approved Error Identification contract:** content.tokens is an ordered nonempty array of whole {id,text} segments; private error_token_ids is a nonempty distinct subset. Every segment is selectable, including repeated visible text with different IDs. Segments wrap independently in reading order with explicit checkbox labels/selected state. They are not reconstructed through offsets, punctuation splitting or Unicode slicing. Offset/span fields (including overlapping/invalid Unicode spans) are unsupported and rejected by the existing strict backend contracts. Thus overlap cannot be represented; this is not a newly implemented span editor/validator. Private optional accepted_corrections retains the existing map from any known token ID to arrays of nonblank strings, including valid empty arrays and non-target references. An advanced JSON field preserves that metadata without a learner correction input or grammar/AI evaluation. Responses emit only selected_token_ids in token order.

Shared option/segment controls preserve IDs and answer associations across text edits/reorder. Removing an entry removes its selected target and correction references; malformed correction JSON stays available for explicit correction and blocks saving. Draft replacement remains atomic; historical publications are never rewritten. Authoring validates nonblank text, legal sets, duplicates and references, while the backend revalidates persistence/publication. Unscored browser previews receive only allowlisted public fields and expose checkboxes/reset/counts, never private sets, corrections, explanation, score or correctness.

Expo **MultiSelectionQuestion/UnscoredMultiPreview** reuse the existing choice styles and shared UI states. multi.ts explicitly projects safe revision data, validates whole IDs/segments, toggles deterministically and builds `{method:'multiple_select',answer:{option_ids:[]}}` or `{method:'error_identification',answer:{selected_token_ids:[]}}`. Native controls expose checkbox checked/disabled state, scalable wrapping text and segment-position labels. Reset, revision/resetKey changes, loading/error/empty/inactive/unmount discard local preview state. Future hosts must use Screen for scrolling and clear their own attempt state on blur/session loss. No learner route is added. Configurable bounds, completion/scoring/partial credit and feedback release remain deferred; see SECTION_14_REPORT.md for actual evidence and device/provider limits.

## Section 13: Identification and Fill in the Blank

The existing protected **/questions** editor/BFF now supports four methods: multiple_choice, true_false, identification and fill_in_the_blank. The other six remain backend contracts only. Existing questions.read/write/publish grants, private-key separation, server authorization, Origin/CSRF, optimistic concurrency, immutable publication, correction revisions, retirement and uncertain-save reconciliation apply unchanged. No new endpoint, permission, table, migration, media, learner-bank route, submission or grader is added.

**Approved additive V1 metadata:** both text contents may declare `input_max_length`, an integer 1–2,000 **Unicode code points per answer**. New editor drafts default to 500; authors may leave it absent. Identification's legacy `{}` and untagged blank content remain valid, with no declared limit. Absent/null metadata is omitted from normalized JSON; stored published rows are never rewritten. Expected-answer metadata must fit a declared limit. Identification retains private accepted_answers/case_sensitive; blanks retain the exact private accepted_answers map. Newline-separated editor answer definitions retain the established nonblank/trimmed metadata semantics; they are not learner responses or a scoring algorithm.

**Approved opt-in template:** fill_in_the_blank may declare `template_syntax: "double-brace-v1"`. Prompt markers use exact `{{blank_id}}`, with existing ASCII IDs of 1–80 letters/digits/underscore/hyphen. Braces are reserved in tagged prompts: malformed, nested, spaced, unclosed or unknown markers are rejected. Every declared ID appears exactly once, in blank_ids order. The editor keeps stable IDs, offers add/remove gap controls, and explicitly saves IDs in passage order with their corresponding private answers. Adding appends its marker; removing removes exact markers. Untagged legacy prompts are displayed literally, with separately labeled gap fields; switching syntax is an explicit draft edit requiring markers. No legacy prompt is silently parsed or changed.

Both previews show plain text only. Tagged passages display `[Gap N]` at marker positions and matching labeled fields below; legacy passages remain unchanged. The browser preview and reusable Expo **TextQuestion/UnscoredTextPreview** receive only public presentation fields. Native text.ts projects authorized revisions explicitly, rejecting malformed templates/limits/IDs and discarding keys/explanations. Raw local input, including spaces, punctuation, case, accents, combining characters, emoji and pasted line breaks, is retained without truncation or normalization. Code-point counters treat emoji as one and a base-plus-combining-mark as two. Over-limit text remains editable and cannot produce a complete response. Empty local buffers are allowed; nonblank complete responses use `{method:'identification',answer:{text}}` or `{method:'fill_in_the_blank',answer:{blanks:[{blank_id,text}]}}`, with exact ID coverage in item order. No correctness feedback is computed.

Backend response contracts now preserve raw text rather than stripping whitespace. Structural blankness checks do not alter the returned/stored value. `validate_response(..., require_complete=True)` offers explicit exact blank coverage; its default remains compatible with existing partial drafts (unknown/duplicate IDs always fail). Per-field limits are enforced against the pinned content metadata. The envelope alone cannot validate completeness/length against a question: future delivery must bind and validate the actual server-selected revision, method and content. No submission API is authorized here.

Expo hosts must wrap text interaction in the established **Screen** for scrolling and keyboard avoidance, unmount/set active=false on blur/session loss, and clear their own attempt-level state. Inputs have scalable labels, multiline raw buffers, next/done focus handling and disabled states; autocorrect/capitalization/spelling are off. Reset, changed revision/resetKey, loading/error/empty/away/unmount discard local buffers. Error/retry states disclose no prior question. Native-device keyboard/IME, screen-reader and multi-viewport behavior remain explicitly unverified where noted in SECTION_13_REPORT.md. Input limits are not grapheme counts or academic policies.

## Section 12: Multiple Choice and True or False interfaces

The protected Next.js **/questions** page now lists/searches/pages the selected method, opens revision history, creates/replaces drafts, creates correction revisions, previews, publishes and retires through the real Section 11 APIs. This supersedes the earlier section's authoring-website exclusion for these two methods only. Other eight method editors and learner delivery remain unavailable. questions.read controls server rendering/navigation; write permits private-key-backed editing; publish/retire still require all three explicit grants. Existing accounts gain no permissions automatically. Real OIDC remains disabled until configured.

Multiple Choice uses at least two nonblank text options, unique stable IDs, ordered arrays and one correct_option_id. IDs are created once per option, preserved when editing/reordering, and never renumbered by display position. Removing the correct option clears the selection and requires a replacement; removal below two options is disabled. True or False stores content={} and a strict boolean key, including false; it has no editable free-form options. Meaningful ordering is the author-chosen array order, not randomization or an invented academic distractor policy. Text only; no new media references.

Forms validate required fields, IDs, text bounds and numeric precision, provide associated field/group errors, retain safe error/conflict information, confirm unsaved navigation and publishing/retirement, and guard close/reload. Lesson/optional competency UUIDs come from existing records: use Curriculum with a separate curriculum.read grant, or operator-provided IDs. No implicit curriculum permission, new catalog or academic review role is added. The backend revalidates relationships and published ancestry. A failed/ambiguous save (network/timeout/5xx) disables further saving until bank/history reconciliation, because initial POST creation is not idempotent. Successful saves reload the actual server revision. Late reads are generation-checked; denial/sign-out clears question/private state. Background/restored/idle access is gated until reverified; no drafts or bearer secrets enter browser storage.

The fixed same-origin **/api/admin/questions/[[...segments]]** BFF accepts only existing collection/item/revision/key/publish/retire shapes, appropriate GET/POST/PUT methods, validated CSRF/If-Match and dedicated admin cookies. JSON writes are bounded to 64 KiB and limited to multiple_choice/true_false; FastAPI still enforces the full definition/permission contract. It forwards no mobile Authorization, unrelated cookies or arbitrary URLs. Protected pages/proxies are no-store; only invalid admin session cookies are cleared on 401.

**Mobile reusable foundation:** apps/mobile/src/features/questions/ChoiceQuestion.tsx exports controlled ChoiceQuestion and an optional UnscoredChoicePreview host. choice.ts projects an authorized revision to explicit key-free presentation fields, builds `{method:'multiple_choice',answer:{option_id}}` or `{method:'true_false',answer:{value:boolean}}`, rejects invalid selections and treats repeated taps as unchanged selection. Presenters display no keys, explanations, scores or correctness. The host resets through explicit reset, changed revision/resetKey, loading/error/empty transitions or active=false/unmount. Future route hosts must unmount/set active=false on blur and clear their own attempt-level state; the component adds no route, credential storage, question retrieval, submission, persistence or grading. Stable IDs, author order, strict false handling, disabled/radio accessibility semantics and local text scaling are retained.

Browser preview likewise receives an allowlist projection and local radio/reset state, independent of the private editor. Unsaved previews require complete valid authoring fields and are labeled administrative/unscored; a draft/published item is never advertised as publicly available. SECTION_12_REPORT.md records actual tests, browser fixture limitations and future prerequisites.

FastAPI owns persistence and authorization in `services/api/app/modules/questions`. This section adds administrator backend contracts, not a question-authoring website, student question browser, assessment renderer, submission API or grader. All automated records are synthetic fixtures. No educational content or real administrator is seeded.

## Approved lifecycle and associations

`questions` is the stable identity; `question_revisions` contains numbered definitions and the lesson/method/language at that version. `locked_at` means published and immutable. A new item starts with revision 1; corrections create a new revision/ID, supplied as a complete validated definition. Draft replacement uses the same revision ID. Multiple drafts may coexist; monotonically allocated numbers are not publication timestamps. Publishing a draft does not rewrite other revisions.

Whole-item status is draft until the first publication, then published, or irreversibly archived on retirement. A published item can also have newer drafts. **An item's published status does not authorize delivery of its newest draft.** Administrative lists describe the latest numbered revision; future delivery must select an explicitly authorized, locked revision. Retirement blocks further authoring/publication but preserves historical reads and assignment/attempt references. No hard-delete/unretire endpoint is provided.

Each revision belongs to an existing lesson; optional competency IDs must be distinct and belong to that same lesson. No minimum tag count is invented. Publication revalidates the stored definition/key and requires published, unretired lesson/topic/version ancestry. Drafts may reference existing unpublished/retired structure, but cannot publish there. Retiring curriculum does not erase previously published questions. Learning language remains english/tagalog metadata, independent of curriculum subject; Filipino is not inferred from Tagalog. No module/level, rich lesson body, media upload or external URL contract is added.

Reuse `question_answer_keys` for private configuration, `grading_version=ungraded-v1` and private explanation. JSON option/token/pair arrays retain author order and stable IDs; response validation checks IDs, not display text. Existing difficulty labels and nonnegative points are metadata, not validated proficiency or awarded scores. Unknown fields, correctness claims, unsupported methods/media and arbitrary grading versions are rejected by authoring schemas.

Existing `assignment_questions.question_revision_id` pins a precise version. Attempts/responses remain attached through immutable assignment-version/composite FK relationships. Future assignment publication must validate live class ownership, lesson/subject/grade/language context, item availability and explicitly pinned locked revisions. History reads need their own authorization/release policy; administrative preview is not permission for learner delivery or research use. Class membership does not imply research consent or controlled-instrument approval.

## Ten methods: existing schema version 1

Definitions, key-free previews and future response envelopes are discriminated unions keyed by unchanged identifiers. They reuse `app/schemas/question_config.py`; no eleventh method is introduced. Response envelopes contain `{method, answer}` only; the eventual attempt API must bind them to a server-selected revision/schema and reject mismatches. No score/correctness claim is accepted. Structural validation allows existing partial drafts; Section 13 adds optional exact blank completeness checks without grading.

| Method | Public content | Private key | Answer payload |
|---|---|---|---|
| multiple_choice | options: [{id,text}], at least 2 | correct_option_id | {option_id} |
| true_false | {} | {value: boolean} | {value: boolean} |
| identification | {input_max_length?}; legacy {} valid | accepted_answers, case_sensitive (existing default false) | {text}, raw |
| fill_in_the_blank | blank_ids, input_max_length?, template_syntax? | accepted_answers map, every blank covered | {blanks:[{blank_id,text}]}, raw |
| multiple_select | options: [{id,text}], at least 2 | distinct correct_option_ids | {option_ids:[]} |
| flashcards | cue | back; optional scoring_rubric_version | {recall:again\|hard\|good\|easy} |
| error_identification | tokens: [{id,text}] | distinct error_token_ids; optional accepted_corrections map | {selected_token_ids:[], correction?:text} |
| word_arrangement | items: [{id,text}], at least 2 | ordered_ids: complete permutation | {ordered_token_ids:[]} |
| sentence_arrangement | items: [{id,text}], at least 2 | ordered_ids: complete permutation | {ordered_sentence_ids:[]} |
| matching_type | left/right: [{id,text}], at least 2 each | pairs: complete one-to-one coverage | {pairs:[{left_id,right_id}]} |

IDs use existing ASCII letters/digits/underscore/hyphen, 1–80 characters. Text is nonblank; IDs must be unique in each relevant side/array, and key/response references must exist. Repeated matching display text with different IDs is representable; no semantic equivalence is assumed. Existing error-correction maps may reference any known token; this section does not silently require their keys to equal the target set. Options/tokens are not sorted or randomized.

Authoring requires lesson_id, language, prompt, method, content and answer_key. Optional fields: instructions, difficulty (default medium), points (default 1, numeric(10,2), nonnegative), schema_version (exact integer 1), competency_ids (default []), grading_version (only ungraded-v1), explanation. Operational limits: prompt/instructions/explanation 8,000 characters each, 200 competency IDs, normalized definition 64 KiB. These are request budgets, not curricular/research counts. Section 13 extends JSON content additively; existing stored payloads and frozen migrations are unchanged.

## Endpoints and permissions

All paths below follow `/api/v1/admin/questions` (collection has no trailing slash). Only the separate administrator cookie is accepted, never mobile Bearer credentials. `questions.read` permits safe administrative preview, including draft/retired history. Private keys additionally require `questions.write`. Writes require read+write; publish/retire additionally require `questions.publish`. Curriculum roles confer no question-bank permission. Exact configured Origin, non-cross-site Fetch Metadata and session-bound CSRF protect mutations. Responses/errors are no-store.

| Method/suffix | Contract |
|---|---|
| GET collection | Item page: status/method/language/lesson_id and literal prompt q filters; limit 1–100 (default 20), offset 0–100000. Latest numbered revision determines method/language/lesson/search matching. Empty legacy identities have null latest fields. Stable created_at descending, UUID tie-break. |
| POST collection | Complete discriminated definition; atomically create identity, revision 1, private key and links. Returns 201 key-free RevisionView. |
| GET /{question_id} | Item summary with whole-item revision marker and latest numbered metadata. |
| GET /{question_id}/revisions | Key-free history, descending version; limit/offset only. Empty history returns items=[]. |
| POST /{question_id}/revisions | Complete definition; allocate next version under item lock; returns 201. |
| GET /{question_id}/revisions/{revision_id} | Key-free RevisionView: definition, IDs, version, root status, locked_at, competency_ids and whole-item revision marker. |
| PUT /{question_id}/revisions/{revision_id} | Complete replacement of an unlocked draft and its key/links in one transaction. |
| GET /{question_id}/revisions/{revision_id}/key | Explicit editor-only KeyView: complete definition including private key/explanation and grading version. |
| POST /{question_id}/revisions/{revision_id}/publish | Revalidate stored definition/ancestry, then lock revision and publish item atomically. No body/caller correctness evidence is used. |
| POST /{question_id}/retire | Archive whole item; preserve revisions, keys and references. |

Writes except initial creation require `If-Match` containing current `revision` from an item/revision read (plain or quoted). Missing → 428; stale/protected/concurrent/FK conflict → 409; missing item or revision/item mismatch → 404; invalid definition/relationships/query → 422; anonymous/invalid/expired/revoked/mobile credential → 401; missing live permission or CSRF/Origin failure → 403. Safe errors never echo private payloads. Creation has no idempotency contract: a lost initial response requires checking the list before deliberate recreation; do not assume automatic retries deduplicate.

The marker covers item/child row identities and update timestamps, not a hash of low-entropy key values. It is a freshness marker, never a secret or authorization token. Lists/history omit key configuration, explanation, grading metadata and correctness fields. Preview still contains author-supplied text; it is not an automated academic-quality or hint-disclosure guarantee.

## Transactions, migration and audit

Authorization locks/revalidates mapped active administrator User and browser session, checks live permissions and CSRF, then performs the domain callback/audit in the same transaction. Acquire advisory **78090001 before domain DML**, exclusive for bank/curriculum writes, shared for materialized reads; lock/refresh Question before checking freshness or allocating versions. Future assignment writers need compatible ordering. PostgreSQL is the sole runtime store.

Complete replacement validates first, removes the old unlocked key/links, flushes, updates content, then inserts validated key/links. Existing ORM hooks never compare new content with an obsolete key. Failures roll back. Existing database freeze/parent-lock triggers preserve published revisions and child keys/links; FKs preserve assignment history. Audit events questions.create/new_revision/replace/publish/retire record actor, item, revision/version, time and request ID; no prompt, key, explanation or session secret.

Additive **0006_question_associations** adds one invoker guard function and triggers on question_competencies, question_revisions and learning_competencies. Association edits and either lesson move are checked under the advisory boundary. Existing mismatches abort migration for operator review; no historical repair/deletion is automatic. No tables/columns/content are added; frozen 0001–0005 remain unchanged. Downgrade removes only these new guards; it is not a normal operational step. Production must restrict trigger disabling, raw SQL/bulk writes and owner privileges. Full JSON validation remains in Pydantic/ORM; direct SQL does not gain a grading engine.

## Operator commands

From services/api, with an operator connection and an already provisioned separate administrator:

```powershell
.venv/Scripts/python -m app.modules.administration.cli grant-questions-read --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli grant-questions-editor --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli grant-questions-publisher --username OperationsAdmin
# Matching revoke-questions-read/editor/publisher commands remove explicit grants.
```

Reader grants read; editor grants read+write; publisher grants read+publish. Publishing/retirement require editor and publisher. Grants are idempotent, reject unexpected role permissions, and never promote mobile accounts. Revocation fails atomically if another role still grants the controlled permission. Grants audit without key/session data. Provisioning still grants dashboard.view only. No new Next proxy/navigation is added ahead of an authorized UI.

## Unresolved scoring and delivery policies

- Identification's explicit accepted_answers and case_sensitive flag are stored; Unicode/case folding, punctuation, diacritics, whitespace normalization, accepted-synonym equivalence and language-specific evaluation are not implemented.
- Multiple-select/error/blank partial credit, penalties, empty/completion rules, duplicate textual answers and weights need approval. Existing partial response shapes remain structurally valid drafts.
- Section 13 explicitly approves tagged double-brace-v1 placeholders and a structural completeness helper; untagged legacy items retain literal prompts. Scoring/partial credit and future submission/release policy remain unresolved.
- Matching currently requires one-to-one keys; many-to-one matching needs a versioned contract. Equivalent display text is not interchangeable IDs.
- Arrangement alternative orders, distractor quality, randomization/seed retention and answer-release/feedback policy remain unresolved.
- Flashcard self-reported recall is ungraded practice, not measured correctness. A rubric reference does not make it an approved scored research instrument.
- No method calculates scores, performs NLP/AI, publishes grades or executes research. Future evaluation needs immutable approved algorithm/rubric versions, snapshots, server-bound attempts and approved release/access policies before controlled scored use.
