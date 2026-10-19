"""Regenerate the implemented data dictionary and complete ERD from model metadata."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: E402, F401
from app.db.base import Base  # noqa: E402
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint  # noqa: E402
from sqlalchemy.dialects.postgresql import dialect  # noqa: E402
from sqlalchemy.schema import CreateIndex  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]

INTRO = """# Implemented database schema — Sections 02–25

Section 25 source head is 0012_class_communication, still 63 tables. Three nullable Message fields (communication_contract, context_class_id, send_request_id) preserve existing destinations and historical rows while class-text-v1 adds class-bound direct communication, owned announcements, sender/key uniqueness and indexed ordering. New invoker guards preserve sent/read history and validate allowed participants; PUBLIC access is revoked. Real-student retention/moderation remains unapproved; synthetic demo records only. See COMMUNICATIONS.md.

Section 22 source head is 0011_result_release. One append-only result visibility ledger increases the total to 63. Explicit owning-instructor release/withdraw/re-release pins one immutable COMPLETE classroom run; live student membership gates scores and original-answer review. Existing captures, grading outcomes and frozen 0001–0010 remain unchanged. See RESULTS_AND_FEEDBACK.md.

Section 21 source head is 0010_grading_results. Two additive immutable evaluation tables increase the total to 62 while preserving all original attempts, submitted responses and assignment/question/key versions. Live administrator grading.read/run controls backend-only computation; no student release or research grading. Engine/policy/Unicode identity, evidence FKs, natural idempotence and transactional sealing preserve auditable results. Frozen 0001–0009 remain unchanged. See GRADING.md; earlier section/count descriptions below are historical.

Section 20 source head is 0009_response_capture (60 tables). Existing AssignmentAttempt adds nullable capture_contract/capture_state/submission_fingerprint. One explicit unscored-capture-v1 attempt can save/resume raw partial responses and finalize once, retaining frozen distribution-only assignment versions and unset scoring/attempt fields. Guards prevent retakes, grading/latency and post-submit mutations; no historical rows are converted. Frozen 0001–0008 remain unchanged. ASSIGNMENTS.md defines controlled Flashcard reveal and the approved response/receipt boundary; earlier scope notes are historical.

Section 19 source head is 0008_assignment_publication (60 tables). AssignmentVersion adds nullable publication_contract/publication_request_id; explicitly marked distribution-only-v1 versions freeze with attempts/points/windows unset. Database guards reject attempts against them and preserve distributed root/version/item history. Existing configured values and frozen 0001–0007 remain unchanged. ASSIGNMENTS.md defines approved subject binding, live membership distribution and metadata-only student reads. The older section descriptions below are historical.

Section 06 reuses this unchanged schema for student enrollment and audit writes; no migration was added. See ENROLLMENT.md for approved multi-class/rejoining policies, transactional authorization and actual membership-based restoration. Earlier descriptions of future enrollment services below reflect the Section 05 storage milestone.

Generated from SQLAlchemy metadata by `services/api/scripts/document_schema.py`.
Models define the relational schema; `migrations/versions/0001_initial.py` freezes its initial DDL plus PostgreSQL guard functions. Revision 0002 adds class request identity, permanent code uniqueness and optional curriculum subjects.
Section 08 adds only separate digest-based administrator browser sessions and single-use OIDC attempts in revision 0003_admin_sessions. Existing mobile identities, RBAC mappings, research guards and frozen migrations are preserved. See ADMIN_AUTH.md for application authorization and provisioning.
Section 09 reuses all tables and IDs for curriculum structure reads. Revision 0004_curriculum_snapshots adds only hierarchy/reference/history guards and a transaction advisory read/write boundary; published versions and previously assigned/completed hierarchy are preserved. See CURRICULUM.md for lifecycle and safe read contracts. No content or new domain table is seeded.
There are {table_count} domain tables; Alembic also manages its own `alembic_version` table.
Post-Section 09 local PostgreSQL verification now executes the integration suite. Revision 0005_constraint_names converges three constraint names without changing integrity or stored data. Fresh empty databases require the explicit execution adapter documented in MIGRATIONS.md; frozen migration files remain unchanged. See LOCAL_VERIFICATION_REPORT.md for evidence and remaining deployment gates.

Section 18 source head is 0007_assignment_drafts. Assignment creation adds nullable creation_request_id/fingerprint with per-instructor UUID uniqueness; new draft max_attempts and item points are explicitly NULL, with no policy inferred. Existing values remain intact. A new guard refuses locking until both are configured. Owner-only draft APIs pin locked question revisions and safe curriculum context; no student publication, attempts or grading. See ASSIGNMENTS.md.

## Responsibilities and conventions

- Identity: users, optional learner/instructor attributes, separate digest-only mobile/admin sessions, digest-only OIDC attempts and administrative identity/permission mappings. A generated canonical username lowercases ASCII under C collation; the username format and uniqueness are enforced by PostgreSQL. ORM input trims surrounding whitespace first. No password field exists. Browser idle/absolute expiry and one-use attempt consumption are enforced transactionally in the administrator service.
- Classes: ownership, grade, optional school subject and distinct learning language, code history and memberships. Class creation does not infer a curriculum subject from language. Six-digit strings preserve leading zeros; a permanent unique code constraint prevents historical reuse; partial unique indexes additionally allow one active code per class. Owner/request UUID uniqueness makes creation retries idempotent. Expiry must be checked by the future enrollment service and stale codes explicitly marked expired. Historical inactive memberships can coexist; duplicate active enrollment cannot.
- Curriculum: version → curriculum-grade → curriculum-subject → quarter → topic → lesson → competency. Grade and subject reference records are reusable. No official curriculum is seeded; provenance starts unverified. Future content services must create new curriculum versions instead of relabeling historical materials.
- Assessments: stable question identity, immutable-when-locked revisions, separate private answer keys and competency links. Assignment identity separates lifecycle status from frozen assignment versions/items. Attempts and responses retain original version associations; composite foreign keys reject responses from a different assignment version.
- Learning: progress and review state belong to personal/classroom/research contexts. Personal/classroom contexts require a student ID. Research contexts require a participant ID and forbid student/class IDs, avoiding a public identity bridge. Review histories preserve scheduler configuration and previous/resulting states; no algorithm is executed here. Event student/item associations are normalized through state/context, not duplicated on every event.
- AI activities: pronunciation reference metadata, independent ASR/evaluator configurations and optional score only in scored status; no raw recording column. Conversation retention defaults off and requires a policy version and deletion deadline before inserts are accepted. No speech pipeline, retention worker or LLM is implemented.
- Research: configurable study/group targets (defaults 30 and 15, not permanent caps), coded participants, private identity/consent, append-only allocation history, controlled levels 1–5, versioned instrument snapshots/results/events and immutable model/scheduler configurations. No enrollment, allocation or experiment execution logic is implemented.
- Communications/operations: class-text-v1 direct/announcement APIs reuse messages and immutable own-viewer message_reads. Direct context_class_id supplements the preserved recipient-versus-class destination rule. No peer/personal chat, automatic notifications, receipt sharing, editing or permanent deletion. Legacy unclassified rows stay untouched and excluded. Inbox notification storage remains unused; audits omit message text. Notification resource IDs and audit entity IDs are optional typed references, not polymorphic foreign keys; future API code must validate them.

All domain tables have UUID primary keys with application/server generation and non-null timezone-aware created_at/updated_at fields. The session uses UTC, and database triggers maintain updated_at even for direct SQL updates. Localized display is a frontend concern. Most foreign keys use RESTRICT; legacy deletion of a conversation session or message can cascade only to its disposable message/read children; class-text-v1 sent messages and receipts reject deletion. Archival/status changes are preferred to deleting referenced records. Application roles must not own schema objects or have TRUNCATE/trigger-disabling privileges.

Only the backend accesses the database. The separate research_private schema revokes PUBLIC access, but its owner/superusers still have access. Production must use distinct migration, ordinary runtime and restricted research credentials/grants; a shared owner credential is not a privacy boundary. No production roles or grants to runtime users are provisioned automatically. Coded exports need future allowlisting and auditing, and must exclude profile IDs, usernames, identity links, consent evidence, free text and credentials.

## PostgreSQL guards outside metadata

- Section 09 freezes published/retired curriculum metadata, descendant links/ordering and referenced global grade/subject labels; legacy draft hierarchy referenced by assignments/progress is protected too. Root retirement preserves content/IDs and publication evidence. All structure writes and history reference changes share an exclusive advisory boundary; reads use its shared form. Future writers must lock before DML. Local PostgreSQL guard checks now execute; deployment grants/performance remain separate gates. See CURRICULUM.md and LOCAL_VERIFICATION_REPORT.md.

- Locked question/assignment versions cannot change or be deleted. A question must start as a draft, have an answer key, then be locked. Assignment locking requires nonempty items with locked question revisions; attempts require a locked assignment version. Parent-row locking serializes child edits against publishing.
- Keys/competency links and assignment items cannot change once their parent revision is locked. New revisions are the update mechanism. Grading algorithms and release/rubric policies remain future work.
- Model versions/configurations, scheduler configurations, review events, points transactions, research allocations/events, consent events, audit logs and learning contexts are append-only. Corrections use new records; policy-approved erasure needs a separately reviewed migration/privileged process.
- A locked study freezes its protocol fields, groups, levels and instruments. Study status and end date remain changeable. Allocation history is append-only; protocol eligibility, balanced allocation, consecutive history numbering, language control and consent gates require future services (Sections 36–38).
- Review state ownership/item/scheduler cannot change; event replay retains its own scheduler reference. Future review services must advance revision/state and append events atomically and verify matching configurations.
- Conversation message writes fail unless the session explicitly permits unexpired retention. Deletion scheduling and consent validation remain future work.

These triggers are in the migration, not Alembic autogeneration. Future revisions must explicitly preserve/update them. The generated SQL files are review artifacts; run Alembic rather than executing them and Alembic twice.

## Complete ERD

All {table_count} domain tables are represented below, including research_private tables (prefixed research_private_). Nodes show keys; the dictionary below documents every implemented column. Relationships derive from all foreign-key constraints, including composite constraints. Optional and unique foreign keys use optional/one cardinality where applicable. This schema does not by itself enforce per-request authorization.

```mermaid
erDiagram
"""


def node(table):
    return table.fullname.replace(".", "_")


def generate() -> str:
    tables = list(Base.metadata.sorted_tables)
    lines = [INTRO.replace("{table_count}", str(len(tables))).rstrip()]
    for table in tables:
        lines.append(f"  {node(table)} {{")
        for column in table.columns:
            if column.primary_key or column.foreign_keys:
                kind = "uuid" if "UUID" in str(column.type).upper() else "string"
                marker = "PK" if column.primary_key else "FK"
                lines.append(f"    {kind} {column.name} {marker}")
        lines.append("  }")
    for table in tables:
        for constraint in sorted(
            table.foreign_key_constraints, key=lambda item: (item.name or "", tuple(item.columns.keys()))
        ):
            parent = constraint.referred_table
            columns = list(constraint.columns)
            optional = any(column.nullable for column in columns)
            unique = any(
                isinstance(c, UniqueConstraint) and set(c.columns.keys()) == set(constraint.columns.keys())
                for c in table.constraints
            )
            unique = unique or any(
                index.unique
                and set(index.columns.keys()) == set(constraint.columns.keys())
                and index.dialect_options["postgresql"].get("where") is None
                for index in table.indexes
            )
            lines.append(
                f'  {node(parent)} {"|o" if optional else "||"}--{"o|" if unique else "o{"} {node(table)} : "{",".join(constraint.columns.keys())}"'
            )
    lines.extend(
        [
            "```",
            "",
            "## Data dictionary",
            "",
            "Every table includes the Entity mixin fields. Defaults shown below are server defaults; application defaults may also exist. CHECK enum lists are stored as VARCHAR + named CHECK constraints, not native PostgreSQL enum types.",
        ]
    )
    for table in tables:
        lines.extend(
            [
                "",
                f"### {table.fullname}",
                "",
                "| Column | PostgreSQL type | Required | Key / reference / server default |",
                "|---|---|---|---|",
            ]
        )
        for column in table.columns:
            notes = []
            if column.primary_key:
                notes.append("PK")
            notes.extend(
                f"FK → {key.target_fullname} ({key.ondelete})"
                for key in sorted(column.foreign_keys, key=lambda item: item.target_fullname)
            )
            if column.computed is not None:
                notes.append(f"Generated: {column.computed.sqltext}")
            elif column.server_default is not None:
                notes.append(f"Default: {column.server_default.arg}")
            lines.append(
                f"| {column.name} | {column.type.compile(dialect=dialect())} | {'yes' if not column.nullable else 'no'} | {'; '.join(notes) or '—'} |"
            )
        lines.extend(["", "Constraints:", ""])
        for constraint in sorted(table.constraints, key=lambda item: (item.name or "", tuple(item.columns.keys()))):
            if isinstance(constraint, CheckConstraint):
                definition = str(constraint.sqltext.compile(dialect=dialect(), compile_kwargs={"literal_binds": True}))
            elif isinstance(constraint, ForeignKeyConstraint):
                definition = (
                    "FK ("
                    + ", ".join(constraint.columns.keys())
                    + ") → "
                    + ", ".join(element.target_fullname for element in constraint.elements)
                )
            else:
                definition = type(constraint).__name__ + " (" + ", ".join(constraint.columns.keys()) + ")"
            lines.append(f"- `{constraint.name}`: {definition}")
        lines.extend(["", "Indexes:", ""])
        if not table.indexes:
            lines.append("- Primary/unique constraint indexes only.")
        for index in sorted(table.indexes, key=lambda item: item.name):
            lines.append("- `" + str(CreateIndex(index).compile(dialect=dialect())).strip() + "`")
    lines.extend(
        [
            "",
            "## Ten method storage contracts",
            "",
            "Relational question_revisions.method is the discriminator, and schema_version=1 selects the current Pydantic contracts in app/schemas/question_config.py. Public content, private keys and student answers use the following fields. Unknown fields/types, duplicate identifiers and invalid option/order/matching references are rejected by ordinary ORM validation hooks. Partial student drafts may be structurally valid; completion rules, normalization beyond the declared flags, partial credit and grading remain future work. Direct SQL/bulk writes do not run these Python validators; database CHECKs still constrain the method and JSON object shape.",
            "",
            "| Method | Public content | Private key configuration | Student answer |",
            "|---|---|---|---|",
            "| multiple_choice | options: [{id,text}], at least 2 | correct_option_id | option_id |",
            "| true_false | empty object | value: strict boolean | value: strict boolean |",
            "| identification | empty object | accepted_answers: nonempty text list; case_sensitive defaults false | text |",
            "| fill_in_the_blank | blank_ids | accepted_answers: map of every blank ID to nonempty answer list | blanks: [{blank_id,text}] |",
            "| multiple_select | options: [{id,text}], at least 2 | correct_option_ids, unique known IDs | option_ids |",
            "| flashcards | cue | back; optional scoring_rubric_version | recall: again/hard/good/easy |",
            "| error_identification | tokens: [{id,text}] | error_token_ids; optional accepted_corrections by ID | selected_token_ids; optional correction |",
            "| word_arrangement | items: [{id,text}], at least 2 | ordered_ids, exact permutation | ordered_token_ids |",
            "| sentence_arrangement | items: [{id,text}], at least 2 | ordered_ids, exact permutation | ordered_sentence_ids |",
            "| matching_type | left/right item lists, at least 2 each | pairs: [{left_id,right_id}], complete one-to-one coverage | pairs: [{left_id,right_id}] |",
            "",
            "Private keys also have grading_version and explanation columns. Never serialize them into learner item payloads. Flashcard recall is self-report, not objective accuracy; scored flashcards require a later approved rubric. No grading or scheduler calculations are implemented.",
        ]
    )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    destination = ROOT / "docs/DATABASE_SCHEMA.md"
    destination.write_text(generate(), encoding="utf-8")
    print(f"Wrote schema dictionary and complete {len(Base.metadata.tables)}-table ERD.")
