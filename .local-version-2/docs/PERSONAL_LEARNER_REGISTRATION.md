# Personal learner registration

Student, teacher, and administrator are the delivered school-client scope. New personal learner registration is disabled by default. Existing personal learner accounts can still sign in, restore sessions, finish setup, and use their saved content and history. No accounts or database records are converted or deleted.

## Configuration and restoration

The API setting is `FLUENTT_PERSONAL_LEARNER_REGISTRATION_ENABLED=false`. Both cookie/browser and native/bearer registration enforce it in the shared creation service. A rejected registration makes no account, profile, or session changes.

The public `GET /api/v1/registration/options` endpoint returns available role names with `Cache-Control: no-store`. The school-client presentation now always hides Personal Learning signup, even if an older backend advertises it. Welcome offers Class Learning, Teach a class and Sign in. Signup still checks registration availability, but offers school account types only; existing sign-in does not depend on the policy request. Old personal-signup links fall back to Student. See CLASS_LEARNING_VERSION5_ENTRY.md for the 2026-11-05 presentation change.

For a separately approved restoration of personal signup:
1. Set `FLUENTT_PERSONAL_LEARNER_REGISTRATION_ENABLED=true` in the API deployment environment (local development: ignored `services/api/.env`).
2. Restart the API workers.
3. Restore the client entry/registration-option presentation as well, then rebuild/redeploy the client. Changing the API flag alone does not advertise personal signup in this school-focused client. No account conversion or database migration is required.

To disable again, set the value to false and restart the API. A previously loaded client may show an older choice until reopened; the server always enforces its current setting before any account writes. Pending sign-in recovery and existing-account login continue normally.

This changes registration policy only. Personal role definitions, protected routes, onboarding, APIs, and data remain supported for existing accounts. Future removal of existing-account access would require a separate explicit decision.
