"""Frozen D11B schema definition shared by migration and metadata creation.

Do not revise this version when adding future authority schemas.
"""

import uuid

import sqlalchemy as sa

TABLE_NAMES = (
    "scheduler_configurations",
    "research_protocols",
    "research_sets",
    "research_set_memberships",
    "participant_allocations",
    "participant_set_conditions",
)


def tables(metadata):
    def uid(name="id", **kwargs):
        return sa.Column(
            name, sa.Uuid(), default=uuid.uuid4 if name == "id" else None, **kwargs
        )

    def string(name, size=128, **kwargs):
        return sa.Column(name, sa.String(size), **kwargs)

    def protocol_fk():
        return sa.ForeignKeyConstraint(
            ["protocol_id", "protocol_version"],
            ["research_protocols.id", "research_protocols.version"],
            ondelete="RESTRICT",
        )

    def set_fk():
        return sa.ForeignKeyConstraint(
            ["research_set_id", "protocol_id", "protocol_version"],
            [
                "research_sets.id",
                "research_sets.protocol_id",
                "research_sets.protocol_version",
            ],
            ondelete="RESTRICT",
        )

    configs = sa.Table(
        "scheduler_configurations",
        metadata,
        string("config_version", primary_key=True),
        string("scheduler_type", nullable=False),
        string("algorithm_version", nullable=False),
        sa.Column("state_schema_version", sa.Integer(), nullable=False),
        sa.Column("canonical_document", sa.Text(), nullable=False),
        string("config_sha256", 64, nullable=False),
        sa.UniqueConstraint("config_version", "config_sha256"),
        sa.UniqueConstraint(
            "config_version",
            "config_sha256",
            "scheduler_type",
            "algorithm_version",
            "state_schema_version",
        ),
        sa.CheckConstraint(
            "config_sha256 = encode(sha256(convert_to(canonical_document, 'UTF8')), 'hex')",
            name="ck_d11_config_hash",
        ),
        sa.CheckConstraint(
            "state_schema_version = 1 AND ((scheduler_type='conventional_srs' AND algorithm_version='sm2-binary-v1' AND config_version='sm2-binary-config-v1' AND config_sha256='3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9') OR (scheduler_type='enhanced_srs' AND algorithm_version='fluentt-esr-fsrs6-binary-v1' AND config_version='fsrs6-binary-r90-config-v1' AND config_sha256='4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f'))",
            name="ck_d11_supported_config",
        ),
    )
    protocols = sa.Table(
        "research_protocols",
        metadata,
        uid(primary_key=True),
        string("version", nullable=False),
        string("mode", nullable=False),
        string("equivalence_approval_reference", 512, nullable=False),
        string("allocation_procedure_version", nullable=False),
        string("period_order_procedure_version", nullable=False),
        string("assignment_freeze_policy_reference", 512, nullable=False),
        string("clock_policy_version", nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
        string("conventional_config_version", nullable=False),
        string("conventional_config_sha256", 64, nullable=False),
        string("enhanced_config_version", nullable=False),
        string("enhanced_config_sha256", 64, nullable=False),
        sa.UniqueConstraint("id", "version"),
        sa.CheckConstraint("mode IN ('formal','test')"),
        sa.CheckConstraint(
            "conventional_config_version='sm2-binary-config-v1' AND enhanced_config_version='fsrs6-binary-r90-config-v1'"
        ),
        *(
            sa.ForeignKeyConstraint(
                [f"{kind}_config_version", f"{kind}_config_sha256"],
                [
                    "scheduler_configurations.config_version",
                    "scheduler_configurations.config_sha256",
                ],
                ondelete="RESTRICT",
            )
            for kind in ("conventional", "enhanced")
        ),
    )
    sets = sa.Table(
        "research_sets",
        metadata,
        uid(primary_key=True),
        uid("protocol_id", nullable=False),
        string("protocol_version", nullable=False),
        string("label", 1, nullable=False),
        protocol_fk(),
        sa.CheckConstraint("label IN ('A','B')"),
        sa.UniqueConstraint("protocol_id", "protocol_version", "label"),
        sa.UniqueConstraint("id", "protocol_id", "protocol_version"),
    )
    members = sa.Table(
        "research_set_memberships",
        metadata,
        uid("protocol_id", primary_key=True),
        string("protocol_version", primary_key=True),
        uid("vocabulary_item_id", primary_key=True),
        uid("research_set_id", nullable=False),
        uid("content_revision_id", nullable=False),
        sa.Column(
            "content_release_id",
            sa.Uuid(),
            sa.ForeignKey("content_releases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        set_fk(),
        sa.ForeignKeyConstraint(
            ["content_revision_id", "vocabulary_item_id"],
            ["vocabulary_revisions.id", "vocabulary_revisions.vocabulary_item_id"],
            ondelete="RESTRICT",
        ),
    )
    allocations = sa.Table(
        "participant_allocations",
        metadata,
        uid(primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        uid("protocol_id", nullable=False),
        string("protocol_version", nullable=False),
        sa.Column("mapping_group", sa.Integer(), nullable=False),
        sa.Column("period_order", sa.JSON(), nullable=False),
        string("assignment_version", nullable=False),
        string("eligibility_reference", 512, nullable=False),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
        protocol_fk(),
        sa.CheckConstraint("mapping_group IN (1,2)"),
        sa.UniqueConstraint("user_id", "protocol_id", "protocol_version"),
        sa.UniqueConstraint("id", "user_id", "protocol_id", "protocol_version"),
    )
    conditions = sa.Table(
        "participant_set_conditions",
        metadata,
        uid(primary_key=True),
        uid("allocation_id", nullable=False),
        uid("user_id", nullable=False),
        uid("protocol_id", nullable=False),
        string("protocol_version", nullable=False),
        uid("research_set_id", nullable=False),
        string("scheduler_type", 64, nullable=False),
        string("algorithm_version", 64, nullable=False),
        sa.Column("state_schema_version", sa.Integer(), nullable=False),
        string("config_version", nullable=False),
        string("config_sha256", 64, nullable=False),
        set_fk(),
        sa.ForeignKeyConstraint(
            ["allocation_id", "user_id", "protocol_id", "protocol_version"],
            [
                "participant_allocations.id",
                "participant_allocations.user_id",
                "participant_allocations.protocol_id",
                "participant_allocations.protocol_version",
            ],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            [
                "config_version",
                "config_sha256",
                "scheduler_type",
                "algorithm_version",
                "state_schema_version",
            ],
            [
                f"scheduler_configurations.{field}"
                for field in (
                    "config_version",
                    "config_sha256",
                    "scheduler_type",
                    "algorithm_version",
                    "state_schema_version",
                )
            ],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("allocation_id", "research_set_id"),
        sa.UniqueConstraint(
            "id",
            "user_id",
            "scheduler_type",
            "algorithm_version",
            name="uq_d11_condition_owner_identity",
        ),
    )
    return configs, protocols, sets, members, allocations, conditions
