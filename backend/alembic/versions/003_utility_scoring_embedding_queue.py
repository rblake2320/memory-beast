"""Add utility scoring columns to memories + embedding_queue table

Revision ID: 003
Revises: 002
Create Date: 2026-03-01
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None

SCHEMA = "memoryweb"


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. Add utility scoring columns to memories
    # -----------------------------------------------------------------------
    op.add_column(
        "memories",
        sa.Column("retrieval_count", sa.Integer(), nullable=False, server_default="0"),
        schema=SCHEMA,
    )
    op.add_column(
        "memories",
        sa.Column("helpful_count", sa.Integer(), nullable=False, server_default="0"),
        schema=SCHEMA,
    )
    op.add_column(
        "memories",
        sa.Column("utility_score", sa.Float(), nullable=False, server_default="0.5"),
        schema=SCHEMA,
    )

    # Index so retrieval router can ORDER BY utility_score DESC efficiently
    op.create_index(
        f"ix_{SCHEMA}_memories_utility",
        "memories",
        ["utility_score"],
        schema=SCHEMA,
    )

    # -----------------------------------------------------------------------
    # 2. Create embedding_queue table
    # -----------------------------------------------------------------------
    op.create_table(
        "embedding_queue",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "target_type",
            sa.String(20),
            nullable=False,
            server_default="memory",
        ),
        sa.Column("target_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "queued_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        schema=SCHEMA,
    )

    op.create_index(
        f"ix_{SCHEMA}_eq_status",
        "embedding_queue",
        ["status"],
        schema=SCHEMA,
    )
    op.create_index(
        f"ix_{SCHEMA}_eq_target",
        "embedding_queue",
        ["target_type", "target_id"],
        schema=SCHEMA,
    )

    # -----------------------------------------------------------------------
    # 3. Backfill embedding_queue for existing memories that have no embedding
    # -----------------------------------------------------------------------
    op.execute(sa.text(f"""
        INSERT INTO {SCHEMA}.embedding_queue (target_type, target_id, status)
        SELECT 'memory', m.id, 'pending'
        FROM {SCHEMA}.memories m
        WHERE m.tombstoned_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM {SCHEMA}.embeddings e
              WHERE e.target_type = 'memory' AND e.target_id = m.id
          )
    """))

    op.execute(sa.text(f"""
        INSERT INTO {SCHEMA}.embedding_queue (target_type, target_id, status)
        SELECT 'segment', s.id, 'pending'
        FROM {SCHEMA}.segments s
        WHERE s.tombstoned_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM {SCHEMA}.embeddings e
              WHERE e.target_type = 'segment' AND e.target_id = s.id
          )
    """))


def downgrade() -> None:
    op.drop_table("embedding_queue", schema=SCHEMA)

    op.drop_index(f"ix_{SCHEMA}_memories_utility", table_name="memories", schema=SCHEMA)
    op.drop_column("memories", "utility_score", schema=SCHEMA)
    op.drop_column("memories", "helpful_count", schema=SCHEMA)
    op.drop_column("memories", "retrieval_count", schema=SCHEMA)
