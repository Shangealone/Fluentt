# FLUENTT

The current integrated application is in **[.local-version-2](.local-version-2/README.md)** on the `fluentt/main` branch. Start there when cloning or pulling this checkpoint. The older top-level `backend/` and `mobile/` trees are historical implementations, not the current integrated startup path.

Follow **[Team setup and updates](.local-version-2/docs/TEAM_SETUP.md)** for frontend dependencies, local configuration, PostgreSQL, migrations, account provisioning, and startup. Each teammate creates their own ignored configuration and database; cloning does not copy the author's accounts, published database content, API credentials, or model checkpoints.

Current stack: Expo mobile/web app, Next.js administrator app, FastAPI, and PostgreSQL 17. Student/teacher signup is available; new personal learner signup is disabled by default. Class proficiency uses the client's assessed Beginner, Intermediate, and Advanced labels.

This is a development/research checkpoint. FIFAKT training and research-readiness work remain documented in `.local-version-2/docs/ESR_IMPLEMENTATION.md`; a running app does not imply those features have been validated for study use.
