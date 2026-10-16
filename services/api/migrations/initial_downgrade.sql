BEGIN;

-- Running downgrade 0001_initial -> 

DROP TABLE vocabulary_review_events;

DROP TABLE student_responses;

DROP TABLE conversation_messages;

DROP TABLE vocabulary_review_states;

DROP TABLE question_competencies;

DROP TABLE question_answer_keys;

DROP TABLE pronunciation_attempts;

DROP TABLE conversation_sessions;

DROP TABLE assignment_questions;

DROP TABLE assignment_attempts;

DROP TABLE vocabulary_items;

DROP TABLE question_revisions;

DROP TABLE pronunciation_activities;

DROP TABLE learning_competencies;

DROP TABLE learner_progress;

DROP TABLE conversation_topics;

DROP TABLE assignment_versions;

DROP TABLE lessons;

DROP TABLE research_group_assignments;

DROP TABLE curriculum_topics;

DROP TABLE research_groups;

DROP TABLE research_assessment_results;

DROP TABLE quarters;

DROP TABLE points_transactions;

DROP TABLE message_reads;

DROP TABLE scheduler_configurations;

DROP TABLE research_private.research_identity_links;

DROP TABLE research_private.research_consent_records;

DROP TABLE research_events;

DROP TABLE research_assessments;

DROP TABLE messages;

DROP TABLE learning_contexts;

DROP TABLE curriculum_subjects;

DROP TABLE class_memberships;

DROP TABLE class_join_codes;

DROP TABLE assignments;

DROP TABLE user_sessions;

DROP TABLE research_participants;

DROP TABLE research_levels;

DROP TABLE questions;

DROP TABLE notifications;

DROP TABLE model_configurations;

DROP TABLE learner_profiles;

DROP TABLE instructor_profiles;

DROP TABLE curriculum_grades;

DROP TABLE classes;

DROP TABLE audit_logs;

DROP TABLE admin_user_roles;

DROP TABLE admin_role_permissions;

DROP TABLE admin_identities;

DROP TABLE users;

DROP TABLE subjects;

DROP TABLE research_studies;

DROP TABLE model_versions;

DROP TABLE grade_levels;

DROP TABLE curriculum_versions;

DROP TABLE admin_roles;

DROP TABLE admin_permissions;

DROP FUNCTION fluentt_freeze_review_scope();

DROP FUNCTION fluentt_guard_conversation_retention();

DROP FUNCTION fluentt_guard_study_protocol();

DROP FUNCTION fluentt_require_locked_assignment();

DROP FUNCTION fluentt_validate_assignment_lock();

DROP FUNCTION fluentt_validate_question_lock();

DROP FUNCTION fluentt_guard_locked_parent();

DROP FUNCTION fluentt_freeze_locked();

DROP FUNCTION fluentt_append_only();

DROP FUNCTION fluentt_touch_updated_at();

DROP SCHEMA research_private;

DELETE FROM alembic_version WHERE alembic_version.version_num = '0001_initial';

DROP TABLE alembic_version;

COMMIT;

