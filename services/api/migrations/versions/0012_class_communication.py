"""Class-bound text communication without rewriting historical destinations."""

from alembic import op
import sqlalchemy as sa

revision = "0012_class_communication"
down_revision = "0011_result_release"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("messages", sa.Column("communication_contract", sa.String(40), nullable=True))
    op.add_column("messages", sa.Column("context_class_id", sa.Uuid(), nullable=True))
    op.add_column("messages", sa.Column("send_request_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_messages_context_class_id_classes", "messages", "classes", ["context_class_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_messages_context_class_id", "messages", ["context_class_id"])
    op.create_index("ix_messages_context_time", "messages", ["context_class_id", "sent_at", "id"])
    op.create_unique_constraint("uq_messages_sender_request", "messages", ["sender_id", "send_request_id"])
    op.create_check_constraint(
        op.f("ck_messages_communication_contract"),
        "messages",
        "communication_contract IS NULL OR (communication_contract = 'class-text-v1' AND context_class_id IS NOT NULL AND send_request_id IS NOT NULL AND char_length(content) BETWEEN 1 AND 4000 AND char_length(btrim(content)) > 0 AND ((message_type = 'announcement' AND class_id = context_class_id AND recipient_id IS NULL) OR (message_type = 'direct' AND class_id IS NULL AND recipient_id IS NOT NULL AND sender_id <> recipient_id)))",
    )
    op.execute("""
    CREATE FUNCTION fluentt_guard_class_message() RETURNS trigger LANGUAGE plpgsql
    SET search_path=pg_catalog,public AS $$
    DECLARE owner_id uuid; recipient_student uuid;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        IF OLD.communication_contract IS NOT NULL OR (TG_OP='UPDATE' AND NEW.communication_contract IS NOT NULL) THEN
          RAISE EXCEPTION 'Class message history is immutable' USING ERRCODE='23514';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END IF;
      IF NEW.communication_contract IS NULL THEN RETURN NEW; END IF;
      SELECT c.instructor_id INTO owner_id FROM classes c JOIN users u ON u.id=c.instructor_id
        WHERE c.id=NEW.context_class_id AND c.status='active' AND c.archived_at IS NULL
          AND u.role='instructor' AND u.profile_status IN ('active','onboarding') AND u.archived_at IS NULL;
      IF owner_id IS NULL THEN RAISE EXCEPTION 'Invalid message class' USING ERRCODE='23514'; END IF;
      IF NEW.message_type='announcement' THEN
        IF NEW.sender_id<>owner_id THEN RAISE EXCEPTION 'Invalid announcement sender' USING ERRCODE='23514'; END IF;
      ELSIF NEW.message_type='direct' THEN
        IF NEW.sender_id=owner_id THEN recipient_student:=NEW.recipient_id;
        ELSIF NEW.recipient_id=owner_id THEN recipient_student:=NEW.sender_id;
        ELSE RAISE EXCEPTION 'Invalid message participants' USING ERRCODE='23514'; END IF;
        IF NOT EXISTS (SELECT 1 FROM users u JOIN class_memberships m ON m.student_id=u.id
          WHERE u.id=recipient_student AND u.role='school_student' AND u.profile_status='active' AND u.archived_at IS NULL
            AND m.class_id=NEW.context_class_id AND m.status='active' AND m.ended_at IS NULL) THEN
          RAISE EXCEPTION 'Invalid message membership' USING ERRCODE='23514';
        END IF;
      ELSE RAISE EXCEPTION 'Invalid message kind' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_class_message BEFORE INSERT OR UPDATE OR DELETE ON messages
      FOR EACH ROW EXECUTE FUNCTION fluentt_guard_class_message();
    CREATE FUNCTION fluentt_guard_class_message_read() RETURNS trigger LANGUAGE plpgsql
    SET search_path=pg_catalog,public AS $$
    DECLARE item messages%ROWTYPE;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        SELECT * INTO item FROM messages WHERE id=OLD.message_id;
        IF item.communication_contract='class-text-v1' THEN
          RAISE EXCEPTION 'Read history is immutable' USING ERRCODE='23514';
        END IF;
      END IF;
      IF TG_OP='DELETE' THEN SELECT * INTO item FROM messages WHERE id=OLD.message_id;
      ELSE SELECT * INTO item FROM messages WHERE id=NEW.message_id; END IF;
      IF item.communication_contract IS DISTINCT FROM 'class-text-v1' THEN
        IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
      END IF;
      IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Read history is immutable' USING ERRCODE='23514'; END IF;
      IF NEW.user_id=item.sender_id THEN RAISE EXCEPTION 'Sender does not need a receipt' USING ERRCODE='23514'; END IF;
      IF item.message_type='direct' AND NEW.user_id<>item.recipient_id THEN
        RAISE EXCEPTION 'Invalid message viewer' USING ERRCODE='23514';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM classes c JOIN users owner ON owner.id=c.instructor_id
        JOIN users viewer ON viewer.id=NEW.user_id
        WHERE c.id=item.context_class_id AND c.status='active' AND c.archived_at IS NULL
          AND owner.role='instructor' AND owner.profile_status IN ('active','onboarding') AND owner.archived_at IS NULL
          AND viewer.profile_status='active' AND viewer.archived_at IS NULL AND
          ((viewer.id=c.instructor_id AND viewer.role='instructor') OR
           (viewer.role='school_student' AND EXISTS (SELECT 1 FROM class_memberships m
             WHERE m.class_id=c.id AND m.student_id=viewer.id AND m.status='active' AND m.ended_at IS NULL)))) THEN
        RAISE EXCEPTION 'Invalid read membership' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_class_message_read BEFORE INSERT OR UPDATE OR DELETE ON message_reads
      FOR EACH ROW EXECUTE FUNCTION fluentt_guard_class_message_read();
    REVOKE ALL ON messages,message_reads FROM PUBLIC;
    """)


def downgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM messages WHERE communication_contract IS NOT NULL OR context_class_id IS NOT NULL OR send_request_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Retained class communication prevents downgrade';
      END IF;
    END $$;""")
    op.execute("DROP TRIGGER guard_class_message_read ON message_reads")
    op.execute("DROP FUNCTION fluentt_guard_class_message_read()")
    op.execute("DROP TRIGGER guard_class_message ON messages")
    op.execute("DROP FUNCTION fluentt_guard_class_message()")
    op.drop_constraint(op.f("ck_messages_communication_contract"), "messages", type_="check")
    op.drop_constraint("uq_messages_sender_request", "messages", type_="unique")
    op.drop_index("ix_messages_context_time", table_name="messages")
    op.drop_index("ix_messages_context_class_id", table_name="messages")
    op.drop_constraint("fk_messages_context_class_id_classes", "messages", type_="foreignkey")
    for column in ("send_request_id", "context_class_id", "communication_contract"):
        op.drop_column("messages", column)
