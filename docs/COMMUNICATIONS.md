# Classroom communication — Section 25

The approved scope is ordinary classroom communication: owning-instructor announcements without replies, and one-to-one messages between that instructor and a currently eligible school student in that class. Either direct participant may initiate. No student peers, personal learners, administrators, research channels or unrestricted recipient lookup.

## Access, content and retention

Every API authenticates a live native mobile device session and revalidates class ownership or active school membership. Class and owner must be available; direct student profiles must be active/unarchived. Announcement reads include current later-joining members. Direct history is visible only to its instructor/student pair within that exact class. Leaving/removal/disablement hides retained history; eligible rejoining restores it. Invitation expiry does not end membership. The same pair's messages in two classes remain separate.

Only plain text, 1–4,000 Unicode code points, is supported. Blank-only, NUL and invalid Unicode are rejected. Accepted leading/trailing whitespace, punctuation and Tagalog/Unicode text remain unchanged; there is no HTML/Markdown execution or automatic link preview. No attachments, editing, deletion, moderation/retention worker, message forwarding, protected grade/question links or automatic research data sharing. The system never queries answer keys, results or private research records to compose communication. Human-entered text is not automatically classified or guaranteed free of confidential content; users must not paste protected material.

The user approved preservation of **synthetic demonstration records** without automatic purge. This does not approve indefinite real-student retention. Retention duration, school/minor privacy arrangements, moderation/escalation, deletion/export and deployment controls remain OPEN before collecting real messages. Development/test fixtures are explicitly synthetic. No real student messages were sent during verification.

## Persistence and security

Existing Message and MessageRead tables are reused. Original Message.recipient_id XOR class_id remains intact. New nullable communication_contract='class-text-v1', context_class_id and send_request_id support direct classroom scope and sender-scoped request identity. Announcements retain class_id=context_class_id and no recipient; directs retain recipient_id and class_id=NULL. No legacy destination or content is rewritten. New APIs exclude unclassified historical messages rather than guessing a class for them.

Migration 0012 adds shape/length checks, unique(sender_id,send_request_id), RESTRICT context FK and context/time indexes. Invoker triggers validate owner/school student/class membership and protect sent records and own read evidence from update/delete. Legacy rows retain their earlier storage behavior; there is no runtime legacy mutation endpoint. PUBLIC grants are revoked; migration/schema owner access is not a production privacy boundary. Runtime least-privilege deployment must configure explicit table/function grants separately.

Authorization, send/read writes and safe audits share one transaction with locked authenticated User/session and class/membership context. School operations follow student→owner→class→membership; instructor target operations take FOR SHARE NOWAIT on the student after owner/class locking, converting inverse contention into retryable 409. User/class ORM rows refresh after waiting. Owner/class locks serialize sends against membership/context changes. Send audits record actor, message/class/kind/contract/request/time only, never raw text, bearer tokens, keys or grades.

A repeated sender UUID key returns the same committed message after live authorization when text, kind, class and recipient match exactly. Changed-body/destination/class reuse returns 409. Interrupted transactions roll back; unknown send outcomes keep the original key/body for retry. Duplicate taps cannot issue parallel requests from the compose host. After restart or an explicitly discarded uncertain send, inspect history before composing again: no insecure durable local retry/token cache exists.

## APIs

Paths follow /api/v1, existing Bearer/transport/process-local throttle conventions and no-store success/errors.

| Method | Path | Purpose |
|---|---|---|
| GET | /communication/classes | Paged active owned/eligible class choices; optional literal q. |
| GET | /classes/{class_id}/communication | Authorized class, instructor and viewer context. Optional student_id verifies/names the direct peer; students can select only themselves. |
| GET | /classes/{class_id}/communication/participants | Instructor-only eligible usernames, optional literal q; no unrelated directory. |
| GET / POST | /classes/{class_id}/announcements | Current-member reads / owner-only immutable sends. |
| GET / POST | /classes/{class_id}/messages/{student_id} | Authorized class-specific instructor–student history / immutable send. |
| GET | /classes/{class_id}/communication/messages/{message_id} | Reauthorized individual message detail; reading alone does not mark it. |
| POST | /classes/{class_id}/communication/messages/{message_id}/read | Strict empty object; idempotent own-viewer read record, no other-user selector. |

Send body is exactly {content}; UUID Idempotency-Key is required. Sender/recipient/type/context/time are derived and validated by the backend. Message DTO contains id, class_id, kind, sender{id,username}, recipient_id, content, sent_at and read for THIS viewer. Sender-owned messages report read=true without a receipt. It exposes no request keys, other participant read times/lists, assessment/research fields or hidden routing metadata.

Lists use limit=1–100/default20, offset=0–100000, has_more and server as_of. History orders sent_at descending then UUID descending. Reuse as_of as timezone-aware before for stable older/newer page navigation; immutable history within that upper bound prevents new sends shifting pages. Refresh starts a new bound. Class/recipient choices sort name/canonical username and UUID; q length≤200 and SQL LIKE metacharacters are escaped literally. Extra query/body fields are rejected where query/schema models apply; no free-form sender/destination override exists.

Anonymous/invalid/expired/revoked session=401; disallowed roles or student announcements/rosters=403; unrelated/missing class/peer/message=generic404; mismatch/contention=409; invalid fields/key/bounds/naive timestamp=422; unavailable DB=503. Generic safe errors and server request IDs never echo content/keys. Database guards are integrity checks, not a substitute for API principal authorization.

## Mobile workflow

Instructor: dashboard **Class communication** or class details → choose class → announcements or direct conversations → choose a current enrolled username. Student: My Classes → **Class communication** → announcements or direct conversation with that class's instructor. Named peer context is verified before the composer renders. Both direct participants may begin an empty conversation.

Compose plain text, send, inspect server timestamp/history, open an individual message to explicitly mark it read for yourself, and refresh to see new messages. Announcements offer no student composer/reply. No push, websocket, typing indicator, automatic notifications or participant receipts are claimed.

Existing Screen/scroll/keyboard-avoidance, Input, Button, Choices, Picker and Expo Router provide wrapping, labels and paging. Composer prevents duplicate presses and confirms route removal with unsaved/uncertain work. Tab/class/recipient/refresh/account navigation uses removal boundaries, not a push that silently discards the compose host. Hardware Back uses the existing prevent-remove flow. Refresh reauthorizes the full context. Lost membership/peer access hides prior messages/compose context; focus/session changes unmount protected state and ignore late responses. No browser SecureStore substitute is added.

Native device, keyboard/orientation/text scaling and TalkBack/VoiceOver execution remain unverified. Backend PostgreSQL tests, handler/component tests and exports do not constitute an authenticated native end-to-end walkthrough. SECTION_25_REPORT.md records actual verification; OCT_21_DEMO_CHECKLIST.md lists demonstration blockers and reproducible synthetic backend smoke commands.
