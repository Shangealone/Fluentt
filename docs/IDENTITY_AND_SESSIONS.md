# Mobile identity and device sessions — Section 03

Implemented backend contracts only. No mobile screens, administrator authentication, classroom enrollment, account recovery or session rotation endpoints were added. All persistence uses the Section 02 users, user_sessions and optional role-specific profile tables. No new tables or migrations are required; 0001_initial is unchanged.

## Username rules and compatibility

New public accounts require an explicitly chosen username of **3–24 ASCII letters, digits or underscores**, with no leading/trailing whitespace. Display case is preserved. Comparison uses lowercase ASCII, matching the generated canonical_username column under PostgreSQL C collation. admin, administrator, system and support are unavailable in any casing.

Existing storage allows 3–32 characters and retains the Section 02 ORM trim behavior. That legacy storage policy is preserved to avoid renaming, deleting or rejecting existing records. Existing valid mobile sessions can still restore a longer legacy username. New public creation applies the stricter Section 03 policy in app/core/usernames.py; both policies use the same canonicalization. The database unique constraint covers all roles, including administrative records. Reserved-name protection applies to new public creation; it does not revoke existing accounts or forbid a future separately authorized administrator profile.

## Implemented endpoints

| Route | Authentication | Success | Other outcomes |
|---|---|---|---|
| GET /api/v1/usernames/check?username=shan123 | Public, throttled | 200: username, available, message | Invalid/reserved names return available=false when storage is available; query length >128 gives 422; 429 throttled; 503 database unavailable |
| POST /api/v1/users | Public, throttled | 201: user plus newly issued session | 422 invalid username/role/extra fields, 409 username taken, 429 throttled, 503 database unavailable |
| GET /api/v1/sessions/me | Authorization: Bearer credential | 200: current mobile profile | 401 invalid/missing/expired/revoked credential or inaccessible profile, 429 throttled, 503 database unavailable |
| POST /api/v1/sessions/revoke | Authorization: Bearer credential | 204, empty body | Same 401/429/503 cases; a second request with the revoked credential gets 401 |

In production, identity routes reject a non-HTTPS ASGI scheme with 400 https_required. Identity responses, including error responses, use Cache-Control: no-store and Pragma: no-cache. Current profile restoration is GET /sessions/me; there is no duplicate /sessions/restore route. No user-ID-based profile lookup or profile/role update route exists.

Availability checks return no user ID, role, profile state or session details. They are advisory: creation rechecks inside its transaction and catches the PostgreSQL canonical-username uniqueness conflict, including concurrent case variants. A duplicate never returns an existing profile or issues a new session.

Request validation occurs before opening storage for POST /users. Availability requires a configured database dependency; if storage is unavailable, return 503 rather than claiming a name is free. General failures use the existing envelope:

```json
{"error":{"code":"username_taken","message":"This username is already taken.","details":null,"request_id":"<request-id>"}}
```

## Creation request and response

```http
POST /api/v1/users
Content-Type: application/json

{"username":"shan123","role":"school_student"}
```

Exactly three public roles are allowed: personal_student, school_student and instructor. Missing fields, administrator/admin roles, client-selected IDs/statuses/privileges and all extra fields are rejected. The service also defends against unsupported roles if a caller bypasses request validation.

A successful response has this shape (placeholders are not valid credentials):

```json
{
  "user": {
    "id": "<server-generated-uuid>",
    "username": "shan123",
    "canonical_username": "shan123",
    "role": "school_student",
    "profile_status": "onboarding",
    "onboarding_step": "class_enrollment",
    "created_at": "<UTC timestamp>",
    "updated_at": "<UTC timestamp>"
  },
  "session": {
    "credential": "<issued-once-secret>",
    "token_type": "Bearer",
    "expires_at": "<UTC timestamp>",
    "absolute_expires_at": "<UTC timestamp>"
  }
}
```

The backend generates UUIDs and saves the user, blank learner/instructor profile and device session in one explicit transaction. Failure to save the session rolls back the entire creation. No class or enrollment is created. Initial onboarding steps are personal_preferences, class_enrollment or first_class respectively. Credentials are returned only after transaction commit.

## Credential design and lifecycle

- A credential is flt_ followed by secrets.token_urlsafe(32): 256 random bits encoded as 43 URL-safe characters after the prefix. SHA-256 of the complete credential is stored in credential_digest; raw credentials never enter database fields, application logs, audit records, URLs or error payloads.
- This hash verifies an unguessable random token, not a human password; no password registration/login or JWT signing secret is introduced. Internal issued-credential objects and response-model representations hide raw credential fields. Explicit 201 JSON serialization is the one intended disclosure.
- Clients send Authorization: Bearer <credential>. Cookies, query parameters, usernames and supplied user IDs do not authenticate. Format checking rejects malformed credentials before storage access. Lookup is by digest; generic 401 messages do not distinguish invalid, expired, revoked, disabled or non-mobile accounts.
- Default inactivity lifetime is 30 days and absolute lifetime is 90 days. A successful authenticated request updates last_used_at and advances expires_at to at most the original absolute expiry. No raw secret is reissued on restoration. Lifetime settings must be positive, with inactivity <= absolute.
- Authentication locks the session/user records for the short validation/update transaction. A committed revoke prevents subsequent validation; concurrent me/revoke operations serialize on these rows. Future business routes requiring revocation validation and a protected write in one transaction must compose those operations deliberately, rather than assuming the authentication dependency holds locks through every later service.
- Revocation affects the current credential only. The table supports multiple sessions but no unauthenticated mechanism attaches a new device to an existing username. There is no public role-changing or administrator-granting path.
- Onboarding and active mobile profiles can restore; disabled/archived profiles and administrator accounts cannot use these mobile sessions.

## Throttling and deployment boundary

The application has bounded, thread-safe in-memory fixed-window counters keyed by a digest of the actual peer address and endpoint group. Defaults per peer/per 60-second window: 30 checks, 10 creation attempts and 60 session requests (me/revoke share a budget). Invalid attempts count too; changing username casing or sending X-Forwarded-For directly does not select another app-level bucket. The counter map has a 4096-bucket cap; new buckets fail with 429 when full instead of evicting active limits. Responses include Retry-After.

These are **single-process** limits. They reset on restart and do not coordinate multiple workers/hosts. Use global reverse-proxy/API-gateway limits before public production deployment or horizontal scaling, with capacity appropriate to classroom shared networks. The app does not read forwarded headers itself; configure the ASGI server to trust only known proxy addresses. HTTPS must terminate at a trusted proxy or server that reports the correct scheme. Do not trust arbitrary forwarded headers to satisfy HTTPS or rate-limit identity.

Configuration (all non-secret):

```dotenv
FLUENTT_MOBILE_SESSION_IDLE_DAYS=30
FLUENTT_MOBILE_SESSION_ABSOLUTE_DAYS=90
FLUENTT_IDENTITY_RATE_WINDOW_SECONDS=60
FLUENTT_USERNAME_CHECK_LIMIT=30
FLUENTT_USER_CREATION_LIMIT=10
FLUENTT_MOBILE_SESSION_REQUEST_LIMIT=60
```

Disable request/response body and Authorization-header logging at the edge. The provided backend startup helper disables Uvicorn access logs to avoid retaining username-check query values; application logs contain request IDs/statuses, not credentials or request bodies. Do not enable token logging in debugging or analytics.

## Returning users and Section 04 integration

1. After explicit username confirmation, submit POST /users once. Immediately store session.credential using Expo SecureStore before navigating to the role-specific onboarding step. Do not persist it in AsyncStorage, ordinary app state snapshots, URLs, analytics, crash reports or console output.
2. On a subsequent launch, read the secure credential and call GET /sessions/me with its Bearer header. Use the returned profile role/status/onboarding_step; never infer ownership from a username.
3. Preserve the stored credential on network failures, 429 or 503. Offer retry; do not silently create another profile. A 401 means the credential cannot restore the profile; do not turn that into a username-based recovery flow.
4. For explicit logout, request POST /sessions/revoke and remove the secure local credential after confirmed revocation. If the response is lost, a following 401 confirms the old credential is unusable; transient network failure alone does not confirm server revocation.

POST /users is intentionally not replayable credential recovery. If commit succeeds but the response is lost, retry returns 409 and cannot redisclose the secret. Reinstall, secure-storage loss, expiry beyond the absolute lifetime and additional-device recovery require a separately reviewed proof-of-ownership design. No automatic retries that create a new username or claim an existing one are implemented. The earlier architectural idempotency proposal is deferred for creation until it can preserve issuance secrecy and recovery semantics safely.

## PowerShell example

After PostgreSQL setup and applying 0001_initial (see MIGRATIONS.md), with the backend running locally:

```powershell
Invoke-RestMethod 'http://localhost:8000/api/v1/usernames/check?username=shan123'
$registration = Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/api/v1/users' -ContentType 'application/json' -Body '{"username":"shan123","role":"school_student"}'
# Keep the issued secret in memory; do not print $registration or its session object.
$sessionHeaders = @{ Authorization = "Bearer $($registration.session.credential)" }
Invoke-RestMethod 'http://localhost:8000/api/v1/sessions/me' -Headers $sessionHeaders
Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/api/v1/sessions/revoke' -Headers $sessionHeaders
Remove-Variable registration,sessionHeaders
```

This is an intentional example account creation request, not something run automatically by setup. It requires a previously unused username. Production uses HTTPS; mobile secure storage integration is deferred to Section 04.

## Verification and limitations

Unit/API tests use clearly test-only repository doubles to check contracts, roles, hashing, cache/log redaction, lifetime/revocation handling, throttling and failure responses. They are not PostgreSQL proof. The PostgreSQL suite uses only a disposable UUID-named database and additionally exercises actual create/restore/revoke, profile/session persistence, expiry/disable handling, concurrent canonical-name conflicts and transactional rollback.

At this milestone PostgreSQL is unavailable: the new 8 and existing 18 PostgreSQL tests skip. Apply/validate the initial migration and run the live suite before relying on production profile/session behavior. There is no SQLite fallback or production in-memory repository. A missing database yields 503, never simulated creation success. No new migration or dependency was introduced.

References: [Python secrets](https://docs.python.org/3/library/secrets.html), [FastAPI HTTP Bearer](https://fastapi.tiangolo.com/reference/security/#fastapi.security.HTTPBearer), [SQLAlchemy session transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html).

## Section 04 preference contract

`PATCH /api/v1/users/me/preferences`, Authorization Bearer, returns the current MobileProfile. JSON accepts `grade` (strict integer 1–12) and/or `language` (`english` or `tagalog`); supplied nulls, extra fields and invalid values are rejected. Empty JSON is a harmless no-op. Only a valid personal_student session can update its own preferences. There is no user ID parameter or role/status mutation input. Authorization and persistence occur under the same session/user transaction lock; invalid/revoked/expired sessions cannot write. Responses retain no-store headers and no credential.

`GET /sessions/me` and profile issuance now include nullable `grade` and `language`. Both persisted values complete personal setup (active, onboarding_step null); saving only one retains onboarding status. School/instructor settings remain controlled by class services. The database's existing learner_profiles.preferred_grade_id and preferred_language columns are reused. Missing numeric grade references are inserted atomically on demand without replacing existing grade IDs/labels. No migration or curriculum content is added.

Mobile routing: no credential -> welcome; personal with missing grade -> grade; missing language -> language; complete -> student; school onboarding -> class-code; instructor onboarding -> first-class. Expo Router protected routes remove prior creation screens when a profile is installed. Secure persistence must succeed before installing the profile. Creation/storage/network errors never restore by username.

## Section 05 restoration update

Identity validation now exposes a shared authenticated transaction context for class services. Expiry/revocation/disabled/archive checks and row locks remain enforced while class writes execute. GET /sessions/me derives instructor status/step from actual owned classes: no class -> onboarding/first_class; any class -> active/no onboarding step. Class creation also persists active completion in the same class/code transaction. Existing personal preferences and school enrollment boundary are unchanged. See CLASSROOMS.md for class authorization and request deduplication.
