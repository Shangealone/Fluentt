# Class proficiency implementation plan

Goal: replace school-grade class grouping in public UI with the client-provided Beginner, Intermediate, Advanced assessment labels. User approved proceeding after providing client terminology.

Contract: add nullable proficiency_level with values beginner, intermediate, advanced. Class grade_level becomes nullable legacy metadata and is omitted from new UI writes. Preserve all existing grade IDs/values; never infer proficiency from grade, age, language, Easy/Medium/Challenging, or activity scores. Class proficiency is optional so existing classes can remain unclassified; label them Level not set. Creation/edit shows the three choices and guidance to use the school's assessment result. Instructor can correct the label; language/legacy-grade restrictions retain their current safety rules.

Eligibility: school grade ceases to constrain classroom lesson selection/sharing. Preserve current owner, live membership, language, subject, publication, archived-class, retained-content, and pinned question/version restrictions. Lesson grades remain informational curriculum metadata. Proficiency does not filter materials without explicit authored mappings. No scoring/research allocation behavior changes.

Scope:
1. Backend: additive migration after 0021, nullable class grade plus nullable checked proficiency; class/enrollment/membership/monitoring projections; registration class-version fingerprint includes proficiency; remove class-grade eligibility predicates only (keep curriculum ancestry). Dedicated checks for new context and authorization retention.
2. Mobile: shared assessment-label utility; create/edit class fields and request validation; class cards/details/join/auth preview/Overview/lesson-sharing summaries use proficiency label, no Grade null. Keep lesson curriculum grade labels. Keep request identity/retry, unsaved controls, navigation and accessibility.
3. Integration: inspect additive migration and back up existing local DB before applying; run focused checks and baseline-aware mobile type/lint; restart API and preserve other running services. Update documentation. No commit/push or APK.

Execution: use current authorized local working tree to update running app. Existing uncommitted school-registration changes must be preserved. Backend and mobile may work independently against this agreed contract. Fresh combined review at end.

Status: implementation complete; schema applied after private backup, record-preservation verification and combined source review.

Delivery: backend/mobile implemented and source reviewed. Thirty focused backend checks pass; mobile retains baseline type/lint findings. Private DB backup taken; migration0022 applied. Existing class grades and all recorded counts verified unchanged. Reviewer finding about0019 sharing grade gate resolved additively in0022 and re-reviewed. API and frontend services restarted. Documentation in CLASS_PROFICIENCY.md.
