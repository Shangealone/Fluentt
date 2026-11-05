"""Join the online parallel-study history and classroom assessment history."""

from alembic import op

revision = "0029_online_class_assessments"
down_revision = ("0027_parallel_test_workflows", "0028_teacher_supplements")
branch_labels = None
depends_on = None


def upgrade():
    op.execute("REVOKE ALL ON TABLE public.assignment_practice_states FROM PUBLIC")
    op.execute("""
    DO $$
    DECLARE client_role text;
    BEGIN
        FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.assignment_practice_states FROM %I', client_role);
            END IF;
        END LOOP;
    END $$;
    """)


def downgrade():
    pass
