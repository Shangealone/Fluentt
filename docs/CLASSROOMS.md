# Instructor classrooms — Section 05

Only instructors with a valid server-issued mobile session may create/list/read/edit their own classes. Ownership always comes from the authenticated user, never JSON. Other mobile roles receive 403; another instructor's UUID and a missing UUID both return 404. Expired, revoked, disabled and archived sessions/users are rejected. Session authentication and classroom mutations share one transaction and user/session lock. Class/code data is returned only after commit, with no-store headers. No student code verification or enrollment route exists yet.

## API contract

All routes require `Authorization: Bearer <device credential>` over HTTPS in production. JSON rejects unknown fields. UUIDs are server identifiers; invitation codes are strings and never authentication.

| Method | Path | Contract |
|---|---|---|
| POST | /api/v1/classes | Create class and code atomically; requires Idempotency-Key UUID header; 201 ClassDetails |
| GET | /api/v1/classes/mine | Owned classes, newest first; limit 1–100 (default 50), offset 0–100000; ClassDetails[] |
| GET | /api/v1/classes/{class_id} | Owned ClassDetails; UUID parameter |
| PATCH | /api/v1/classes/{class_id} | Owner-only allowed metadata; ClassDetails |

Create fields: class_name (trimmed 1–150 characters), grade_level (strict integer 1–12), language (english/tagalog), optional description (null or trimmed text up to 500). Grade references are upserted by number without replacing existing IDs/names. No official curriculum is populated. The accepted form has no curriculum subject, so subject_id is nullable and left unset; do not infer Filipino from the Tagalog learning track. A later curriculum/assignment service must explicitly bind and validate subject/context before publishing content.

Patch accepts only optional class_name, grade_level, language and description. Supplied name/grade/language cannot be null. Description can be cleared with null. Grade/language can change only while no subject, membership (including historical), assignment, learning context or class message is attached. The class row is locked before checking relationships; future enrollment/content writers must also lock/re-read the class before validating its context. A subject-bound class is conservatively frozen because compatibility rules are not yet implemented. Archived classes reject edits. Name/description edits never change codes, owners or status. Rotation/revocation/archive APIs are not implemented.

ClassDetails: id, class_name, grade_level, language, description, join_code, status, created_at, updated_at. join_code is exactly six digits or null if an existing class has no active/unrevoked/unexpired code. Dates are UTC server timestamps. No invented roster/student count is returned.

## Synthetic request/response example

This example is documentation, not a PostgreSQL execution result. The code below is illustrative; the server generates a fresh value.

```http
POST /api/v1/classes
Authorization: Bearer <device credential>
Idempotency-Key: 8e5f64dd-7575-4262-a5d9-592cf24477c0
Content-Type: application/json

{
  "class_name": "Grade 5 English A",
  "grade_level": 5,
  "language": "english",
  "description": "Vocabulary and language activities"
}
```

```json
{
  "id": "4080972e-a967-4794-94b3-0b8dfc79cc6f",
  "class_name": "Grade 5 English A",
  "grade_level": 5,
  "language": "english",
  "description": "Vocabulary and language activities",
  "join_code": "000042",
  "status": "active",
  "created_at": "2026-10-17T00:00:00Z",
  "updated_at": "2026-10-17T00:00:00Z"
}
```

## Code and retry guarantees

The server uses `secrets.randbelow(1_000_000)` formatted to six digits. A permanent unique constraint on class_join_codes.code forbids reuse even after expiry/revocation; existing partial unique indexes still limit active codes to one per class. There are at most one million historical values; a bounded 12-attempt allocator returns a safe 503 and rolls back the class if it cannot reserve one. Savepoints isolate unique-code collisions while retaining the surrounding transaction; only recognized PostgreSQL uniqueness violations are retried. Unexpected errors roll back everything. No predictable IDs, clocks or counters generate codes.

POST deduplication uses unique (instructor_id, creation_request_id). The secure session locks the owning user, serializing concurrent requests for that instructor, including requests from different sessions. The same UUID and normalized body replays the saved class with 201; changing that body returns 409. A replay after later metadata editing may conflict, so refresh My Classes rather than repeatedly changing the original request. Creation request IDs are not credentials.

Mobile creates UUID request IDs with Expo Crypto. A pending submission keeps its original body/key in memory; network/5xx retries reuse them, and form edits are blocked until resolution. Definitive 4xx errors permit correction. Repeated taps are single-flight. On relaunch no POST runs automatically: GET /sessions/me derives instructor completion from actual owned class records, so an already committed class restores the dashboard even if its response was lost. No class restores first-class setup. A force-close loses the in-memory retry key; inspect My Classes before deliberately starting an additional class.

## Throttling and next-section security

Creation adds FLUENTT_CLASS_CREATION_LIMIT=10 per peer per window to the existing bounded limiter; all class routes use the session request limit. The default window is 60 seconds. Limits are process-local and require global edge enforcement before multiple workers/production. Six-digit codes have limited guessing resistance: Section 06 must add authenticated school-student verification limits per session and peer, generic invalid/expired errors, minimal preview data, explicit confirmation and transactional enrollment. A code never authenticates a profile or supplies consent. None of that enrollment logic is implemented here.

## Mobile flow

First-class form -> confirmed POST response -> details/code confirmation -> Copy Code / Share Code -> My Classes. Additional classes reuse the form and create new records. Details/edit routes accept only class UUIDs; secrets and invitation codes are not passed as route credentials. My Classes refetches on focus and supports paginated loading. Editing reuses validation and keeps the invitation code. Native share feedback says the share sheet opened, not that a recipient received anything. Clipboard failure/cancelled sharing is reported accurately.

The browser app retains Section 04's navigation-preview policy: native SecureStore is required for actual profile/session creation. The separate static visual review uses synthetic data and inert server-rendered controls; it neither creates accounts/classes nor bypasses authentication in runtime routes.
