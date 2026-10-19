# Student class enrollment — Section 06

Section 19 published assignment metadata uses the same live eligible active membership/class/owner rules, including later joiners and eligible rejoiners. Leaving/removal or class/owner deactivation removes access; invitation expiry does not. No frozen recipient cohort, notification, attempt or research consent is implied. See ASSIGNMENTS.md. Older migration/head statements below describe the Section 06 milestone.

School students use their existing device credential. Class invitations do not authenticate a user, create another identity, grant instructor privileges, or provide research consent. Runtime persistence is PostgreSQL only. No new table or migration is required; head remains `0002_class_creation`.

## Approved policies

- A school student may belong to multiple active classes. Initial onboarding joins one; My Classes lists eligible memberships and permits another invitation-code entry.
- Duplicate confirmation returns the existing eligible active membership with HTTP 200. It creates neither another membership nor another enrollment audit event.
- A student who left may verify again and create a new membership row. Historical rows remain intact. Any prior instructor removal from that class blocks self-enrollment. No removal, departure, or reinstatement API is introduced here.
- Eligible membership means active membership without `ended_at`, active/unarchived class, and an instructor owner who is not disabled/archived. Invitation expiry/revocation does not terminate an existing membership. Ineligible history is retained but grants no access and does not complete school onboarding.
- New enrollment also requires a six-digit active, unrevoked invitation whose expiry is absent or in the future. A null curriculum subject remains permitted; language never implies subject.

## Implemented API

All endpoints require `Authorization: Bearer <device credential>`, the school-student role, HTTPS in production, and return no-store headers. Input rejects unknown fields. Codes are strings of exactly six ASCII digits, sent only in JSON bodies.

| Method | Path | Request / response |
|---|---|---|
| POST | `/api/v1/class-enrollment-previews` | `{code}` -> class_name, grade_level, language, optional/null instructor_display_name, class_version |
| POST | `/api/v1/class-memberships` | `{code, class_version}` -> committed MembershipDetails; HTTP 200 for new or existing membership |
| GET | `/api/v1/class-memberships/mine?limit=50&offset=0` | Own eligible MembershipDetails list; limit 1–100, offset 0–100000 |
| GET | `/api/v1/sessions/me` | Existing route now derives school-student active/onboarding status from actual eligible membership existence |

MembershipDetails contains only id, class_id, joined_at, status=active, class_name, grade_level, language and nullable instructor_display_name. It excludes other students, owner IDs/usernames, invitation codes, credentials, descriptions and research data. Existing instructor class-detail APIs remain instructor-only.

Preview does not enroll. Confirmation is a separate explicit action. Unknown, expired, revoked, archived, owner-unavailable and removal-blocked invitations share generic HTTP 404 `invitation_unavailable`. Invalid shapes return 422; wrong role 403; invalid/expired/revoked credentials 401; unavailable storage 503; throttling 429 with Retry-After. Changed preview details/history return 409 `preview_changed`, requiring verification and review again.

## Preview freshness and retry lifecycle

The approved Section 06 design uses no short-lived preview token or server preview table. The conceptual token proposal in API_DESIGN is superseded for this implementation by resubmitting the code and an optimistic `class_version`. This SHA-256 fingerprint covers the server class/code versions, displayed class fields and that student's membership history. It is neither secret nor authorization; a client identifier/fingerprint never grants membership. The server authenticates and revalidates current invitation/class/role/history regardless of the supplied version.

The preview marker has no independent TTL. It becomes stale when the relevant snapshot changes, and confirmation always checks current availability. A stale marker cannot create membership after a departure; the student must review a new preview. Existing active membership is returned before freshness comparison, allowing lost-response retries without duplicating enrollment. If the invitation expires or is revoked after a successful commit, retrying the invitation returns unavailable; GET memberships/me and session restoration still recover the saved membership.

Authentication locks the session/student rows through the entire service transaction. Verification/confirmation resolve invitation IDs, acquire a shared owner lock, then class and code locks, and re-read eligibility. Owner-before-class order matches existing instructor writes. Student locking serializes simultaneous requests from different sessions for the same student. The existing partial unique membership index remains authoritative. New membership, onboarding completion and a safe `class.enrolled` audit event commit together; failures roll everything back. No class/code or historical membership is deleted by runtime enrollment.

Future class/membership writers must preserve the same authenticated transaction and lock ordering, revalidate context and keep historical rows. No unvalidated bulk membership writer is authorized by this implementation.

## Abuse protection

`FLUENTT_ENROLLMENT_PEER_LIMIT=60` and `FLUENTT_ENROLLMENT_SESSION_LIMIT=10` apply to preview and confirmation together per existing 60-second window. Peer attempts count before storage access; valid school-student sessions additionally have a session-ID bucket. Buckets contain hashes, never credentials/codes. Listing uses the existing session-request peer budget. Limits are bounded and process-local; production/multiple workers still require global edge limits, trusted proxies and reviewed shared-classroom-network capacity. No distributed protection is claimed.

## Mobile behavior

The existing class-code screen now provides numeric input, validation, verify/loading/error states, a distinct preview with Join Class and Cancel, and saved success only after the server response. It reuses the keyboard-aware Screen and accessible controls. Single-flight guards prevent duplicate verification/confirmation. Interrupted confirmations retain their original code/version in memory for manual retry. A definitive 4xx except 429 clears the preview; rate limits/network/5xx preserve retry state. Cancel cannot undo a committed enrollment; Check saved classes refreshes backend completion after an uncertain response.

Startup uses the existing SecureStore credential and GET sessions/me. No eligible membership -> class-code; eligible membership -> student with an authenticated, paginated My Classes list. The enrollment screen remains available to active school students to join another class, with Back to My Classes. Pending requests block hardware Back; preview Back cancels review. Stale list responses are ignored after navigation; loading/errors do not claim current class data. Personal preferences and instructor management retain their existing behavior. Broader dashboard/navigation work remains Section 07.

Web remains a navigation preview with native SecureStore required for account creation. There is no browser credential fallback, demo authentication bypass, local membership authority, or success fixture in runtime code.

## Validation

See SECTION_06_REPORT.md for actual results. PostgreSQL tests use only the existing generated UUID database fixture; unset infrastructure skips explicitly. Repository doubles and client-port tests do not prove PostgreSQL constraints, row locks or native device behavior.

## Section 07 mobile selection

The school dashboard now offers radio-style selection among its fetched eligible membership records, displaying the selected class context and enrollment state. Selection is local/transient and does not authorize API operations or alter enrollment. Missing selections fall back only to another currently returned membership; loading/errors hide class context. Pagination and Join another class remain available. All Section 06 enrollment policies, API authorization and database contracts are unchanged.
