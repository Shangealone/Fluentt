# Personal learner registration

Student, teacher, and administrator are the delivered school-client scope. New personal learner registration is disabled by default. Existing personal learner accounts can still sign in, restore sessions, finish setup, and use their saved content and history. No accounts or database records are converted or deleted.

## Configuration and restoration

The API setting is `FLUENTT_PERSONAL_LEARNER_REGISTRATION_ENABLED=false`. Both cookie/browser and native/bearer registration enforce it in the shared creation service. A rejected registration makes no account, profile, or session changes.

The public `GET /api/v1/registration/options` endpoint returns available role names with `Cache-Control: no-store`. Welcome and signup use this response. During loading or a failed policy request the UI offers school account types only; existing sign-in does not depend on the policy request. Old personal-signup links fall back to Student when disabled.

To restore personal signup:
1. Set `FLUENTT_PERSONAL_LEARNER_REGISTRATION_ENABLED=true` in the API deployment environment (local development: ignored `services/api/.env`).
2. Restart the API workers.
3. Reopen or reload the welcome/signup screen. Personal learner registration returns automatically, including its existing artwork and onboarding destination. No mobile rebuild or database migration is required.

To disable again, set the value to false and restart the API. A previously loaded client may show an older choice until reopened; the server always enforces its current setting before any account writes. Pending sign-in recovery and existing-account login continue normally.

This changes registration policy only. Personal role definitions, protected routes, onboarding, APIs, and data remain supported for existing accounts. Future removal of existing-account access would require a separate explicit decision.
