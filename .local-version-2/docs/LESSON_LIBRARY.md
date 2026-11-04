# Shared administrator lesson library

`version-5` contains a content-only snapshot of the administrator curriculum library. After pulling or switching to this branch, start the API using the supported command from `.local-version-2`:

```powershell
.\scripts\start.ps1 api
```

After the normal database/migration preflight, the command loads `services/api/content/administrator-library.v1.json` in one transaction before starting the API. Repeated starts do not create duplicates. The snapshot preserves curriculum hierarchy, lesson reading materials, competencies, question definitions and answer keys, and existing publication/retirement status. It includes no user accounts, administrator identities, passwords, sessions, classes, memberships, assignments, answers, research records, or instructor-owned lessons.

Each groupmate still configures their own database and administrator login. Fresh databases must first follow `TEAM_SETUP.md`, including migrations. This loader never migrates, resets, or deletes a database. It does not grant permissions. Published lessons remain subject to the app's existing visibility and class-eligibility rules.

The loader is restricted to `FLUENTT_ENVIRONMENT=development`. It retains existing question authors and maps matching grade numbers and subject codes to local reference IDs. Conflicting local content stops loading and rolls back the import; it is never silently overwritten. Review the conflicting content before retrying. Keep a private backup before resolving conflicts; do not reset a populated database to bypass them.

## Direct API startup

Starting Uvicorn directly bypasses the PowerShell loader. Run this once from `services/api` before starting it:

```powershell
.\.venv\Scripts\python.exe -m app.modules.curriculum.library_bundle import
```

To validate against a database without retaining changes:

```powershell
.\.venv\Scripts\python.exe -m app.modules.curriculum.library_bundle check
```

## Updating the shared snapshot

After administrator lesson changes are approved, export the content from the designated source database:

```powershell
.\.venv\Scripts\python.exe -m app.modules.curriculum.library_bundle export
```

Review the JSON diff and scan for credentials/private text before committing and pushing it. Exporting does not change or publish source records. Git transfers this snapshot, not database files. Further database edits do not reach teammates until a refreshed snapshot is committed. Published-content corrections should use new curriculum versions; the loader preserves frozen local history.

Answer keys are server-side content and must not be copied into public frontend assets. This development snapshot is intended for the trusted project team with repository access.
