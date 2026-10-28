# School operational summary CSV

Endpoint: `GET /api/v1/admin/oversight/summary.csv`, through `/api/admin/oversight/summary.csv`. Dataset is **operational school counts**, not a thesis participant/outcome export. Requires live `oversight.read` and `oversight.export`; every successful backend export records `admin.operational_summary_exported` without raw learner data. No selected user/class filter applies; the button explicitly downloads the current whole-school summary.

| Column | Meaning |
| --- | --- |
| metric_version | `admin-school-oversight-v1` projection contract |
| as_of_utc | Server UTC ISO-8601 snapshot timestamp; one value for all rows |
| metric | One of the fixed identifiers below |
| count | Nonnegative PostgreSQL integer count |

| Metric | Population / denominator definition |
| --- | --- |
| active_students | Current role school_student, active profile, non-archived user |
| active_instructors | Current role instructor, active profile, non-archived user |
| active_classes | Active non-archived classroom with active non-archived instructor owner |
| enrolled_students | Distinct currently eligible active school-student IDs with an active, non-ended membership in an eligible classroom |
| eligible_memberships | Membership rows under the same eligibility rule; one student in two classes counts twice |

These are counts with an explicit population, not percentages/rates or a fixed 30-person recruitment denominator. A school user/class may have a research designation, but these counts do not query coded participant records or research events and do not express consent, study enrollment or experimental outcomes. Personal users/history are excluded. No username, class code, credentials, instrument answers or audio is exported.

Zero means a successful observed count of zero. There are no null count cells in this CSV: unavailable database/permission/service returns an error and no dataset, not fabricated zero. Other web analytics show N/A where measurement is unavailable. Counts are current rather than a historical observation window; no duration, missed day, completion/mastery or retention is inferred. Fixed metric identifiers, constant version, server timestamps and integer counts cannot produce spreadsheet formulas. CSV is UTF-8 with a header and standard quoted fields/CRLF lines.

Research exports retain their separate [RESEARCH_EXPORT_DATA_DICTIONARY.md](RESEARCH_EXPORT_DATA_DICTIONARY.md) and publication/privacy/consent gates; this file does not authorize their release. Personal activity retains `client-reported-activity-v1` in [ADMIN_PERFORMANCE.md](ADMIN_PERFORMANCE.md).
