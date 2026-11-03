# Checkpoint readiness evidence

This checkpoint includes school-focused signup, optional client-assessed class proficiency, preserved legacy class grades, clone/setup corrections, and frontend/backend readiness fixes. It is a development checkpoint, not a claim that every deployment or study workflow is validated.

## Verified in this checkpoint

- Full backend non-PostgreSQL suite: 837 passed, 222 deselected, 2 dependency-deprecation warnings.
- Focused disposable PostgreSQL readiness suite: 8 passed. Fresh empty database migrated through0022, creation/editing of classes without school grade, first teacher lesson publication/subject-binding/share, public class preview, atomic school signup and membership restore. The generated test database was cleaned up; the application database was not used as a test target.
- API dependencies: all41 pinned requirements match installed versions; compatibility check passed.
- Learner/instructor web source: typecheck passed; lint passed with6 existing refresh-dependency warnings; web export passed (1041 modules,43 bundles). This was web/compile verification, not testing on a mobile device.
- Admin: typecheck, lint, isolated production build,12 admin-web contract checks,16 explicit-development-demo research setup checks, and4 demo-access regression checks passed.
- Actual clean dependency installs from isolated copies of package/lock manifests: mobile779 packages, admin344 packages. Node used the Windows trusted certificate store to resolve this machine's registry certificate-chain error; TLS verification stayed enabled. npm reported dependency-deprecation/optional install-script policy warnings.
- Setup environment helper tested in a private temporary copy: all3 local environment files created, browser secret generated without output, repeated execution preserved their hashes.
- Startup scripts parse. Read-only API startup preflight passed against the local database: connection, migration head, and browser-session configuration ready.

## Fixes included

Readonly React Native style construction and component-ref typing, missing demo API method and render-ref lint blockers; first-time lesson sharing now flushes confirmed subject binding before its database trigger; ORM sharing constraint names match deployed DDL. Current migration-backed schema checks replace obsolete71-table snapshots while retaining unchanged frozen-table checks. Offline generation through introspection-dependent migrations now reports a clear requirement for an online database; fresh online migration is verified.

Admin and frontend API templates now agree on8001. The API helper no longer requires the author's private PostgreSQL folder on a fresh clone. It checks configuration/schema before serving and does not silently migrate. Root documentation points to .local-version-2. Admin mock access is development-only and requires explicit FLUENTT_ENABLE_ADMIN_DEMO=1; defaults off and production always off, including forged mock cookies.

## Required teammate configuration and remaining limits

Follow TEAM_SETUP.md. Each teammate needs their own ignored environment files and PostgreSQL database, explicit migrations, and account/content provisioning. Git does not distribute private database records, API keys, OIDC identities, published database content, speech/model assets or trained FIFAKT artifacts.

The complete PostgreSQL integration suite is not certified by this checkpoint. Exploratory older identity/enrollment tests contained stale school-registration fixtures; the8 focused fresh-database contracts above are the verified PostgreSQL scope. Full real-provider, institutional research, deployed TLS, concurrency, and manual user acceptance remain separate requirements. Administrator OIDC/MFA requires actual operator/provider setup. ESR retains its trained-model/study-readiness gates.

Per the user's instruction, mobile/native testing is deferred to Thesis2: no Android/iOS build, APK, phone/emulator acceptance, microphone/native recording, device permissions or native navigation tests were performed. No further mobile testing is part of this checkpoint push.
