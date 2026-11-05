# Track 1 study enrollment

2026-11-05. Implemented for disposable development testing; live enrollment BLOCKED.

Ordinary class membership never creates research participation. Authorized administrators separately configure the synthetic workflow and supply an existing eligible school-account UUID, literal eligibility confirmation and every configured consent kind. Every approval/consent reference must explicitly begin SYNTHETIC:. Protocol, ethics and site references are mandatory. These values represent fixtures, not actual institutional approval.

The service rechecks active school role, profile, archival state, current class membership, study contract, clearance hash, all current permission records and conflicting active studies. It creates a coded ResearchParticipant and private ResearchIdentityLink, appends consent evidence, then reuses the original locked allocation service. The 30 reserved slots retain the existing seeded balanced 15/15 procedure; group assignments and seed are not returned to participants. Enrollment/allocation timestamps and coded event evidence are retained.

Identical enrollment retries return the existing allocation. Changed consent/body conflicts; withdrawn/completed participants cannot be silently reenrolled. No replacement of withdrawals or slot reuse. Concurrent identical enrollment calls are tested against separate PostgreSQL connections.

Withdrawal is an explicit own-account action, available even after class-membership loss. It records withdrawn status/time, appends withdrawn consent records and a retained workflow event. Original identity, allocation and attempt history remain. Retrying withdrawal is idempotent; subsequent assessment/activity access fails. Directory status is distinguishable from incomplete work.

Administrator preparation retains actual eligible/enrolled/allocation counts from existing records. Owner-only instructor monitoring returns coded statuses for current eligible class identities, excludes removed/inactive accounts and does not expose participant-to-condition mappings. It is bounded to the 30-slot study.

Verified automated evidence is in CLASS_LEARNING_TEST_RESULTS.md: eligible 30-account fixtures, 15/15 counts, identical/changed retry behavior, role/consent/membership/clearance gates, unauthorized attempt access, withdrawal, admin permissions/CSRF and concurrent requests. These tests are synthetic and not participant consent evidence.

Remaining: approved recruitment/eligibility/age/consent process, responsible data controller, real evidence review, identity-access policy, withdrawal consequences for analysis, and separately authorized production architecture. Existing test-only endpoints intentionally cannot enroll real participants.
