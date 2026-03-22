"""Idempotency constraints: unique on segments, tags, embeddings, embedding_queue

Revision ID: 004
Revises: 003
Create Date: 2026-03-01
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

SCHEMA = "memoryweb"


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 0. Clean up existing duplicates before adding constraints
    # -----------------------------------------------------------------------

    # segments: keep the lowest id per (conversation_id, start_ordinal, end_ordinal)
    op.execute(sa.text(f"""
        DELETE FROM {SCHEMA}.segments
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY conversation_id, start_ordinal, end_ordinal
                           ORDER BY id
                       ) AS rn
                FROM {SCHEMA}.segments
            ) sub
            WHERE rn > 1
        )
    """))

    # tags: keep lowest id per (segment_id, axis_id, value)
    op.execute(sa.text(f"""
        DELETE FROM {SCHEMA}.tags
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY segment_id, axis_id, value
                           ORDER BY id
                       ) AS rn
                FROM {SCHEMA}.tags
            ) sub
            WHERE rn > 1
        )
    """))

    # embeddings: keep the most recent (highest id) per (target_type, target_id)
    op.execute(sa.text(f"""
        DELETE FROM {SCHEMA}.embeddings
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY target_type, target_id
                           ORDER BY id DESC
                       ) AS rn
                FROM {SCHEMA}.embeddings
            ) sub
            WHERE rn > 1
        )
    """))

    # embedding_queue: for non-done items, keep only most recent per (target_type, target_id)
    op.execute(sa.text(f"""
        DELETE FROM {SCHEMA}.embedding_queue
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY target_type, target_id
                           ORDER BY id DESC
                       ) AS rn
                FROM {SCHEMA}.embedding_queue
                WHERE status NOT IN ('done')
            ) sub
            WHERE rn > 1
        )
    """))

    # -----------------------------------------------------------------------
    # 1. segments: unique per conversation per (start_ordinal, end_ordinal)
    # -----------------------------------------------------------------------
    op.create_unique_constraint(
        "uq_segments_conv_ordinal",
        "segments",
        ["conversation_id", "start_ordinal", "end_ordinal"],
        schema=SCHEMA,
    )

    # -----------------------------------------------------------------------
    # 2. tags: multi-value safe — one row per (segment, axis, value) triplet
    #    Drop old non-unique index first, then add unique constraint
    # -----------------------------------------------------------------------
    op.drop_index(f"ix_{SCHEMA}_tags_segment_axis", table_name="tags", schema=SCHEMA)
    op.create_unique_constraint(
        "uq_tags_segment_axis_value",
        "tags",
        ["segment_id", "axis_id", "value"],
        schema=SCHEMA,
    )

    # -----------------------------------------------------------------------
    # 3. embeddings: one vector per (target_type, target_id)
    #    Enables ON CONFLICT (target_type, target_id) DO UPDATE in the worker
    # -----------------------------------------------------------------------
    op.create_unique_constraint(
        "uq_embeddings_target",
        "embeddings",
        ["target_type", "target_id"],
        schema=SCHEMA,
    )

    # -----------------------------------------------------------------------
    # 4. embedding_queue: partial unique prevents duplicate in-flight items
    #    Multiple 'done' entries for the same target are still allowed
    # -----------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE UNIQUE INDEX uq_eq_target_active
        ON {SCHEMA}.embedding_queue (target_type, target_id)
        WHERE status IN ('pending', 'running')
    """))


def downgrade() -> None:
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.uq_eq_target_active"))
    op.drop_constraint("uq_embeddings_target", "embeddings", schema=SCHEMA)
    op.drop_constraint("uq_tags_segment_axis_value", "tags", schema=SCHEMA)
    op.create_index(
        f"ix_{SCHEMA}_tags_segment_axis",
        "tags",
        ["segment_id", "axis_id"],
        schema=SCHEMA,
    )
    op.drop_constraint("uq_segments_conv_ordinal", "segments", schema=SCHEMA)
