"""Initial memoryweb schema

Revision ID: 001
Revises:
Create Date: 2026-02-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


def _pgvector_available():
    """Check at migration time if the vector extension is installed in PostgreSQL."""
    try:
        conn = op.get_bind()
        result = conn.execute(
            sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        ).fetchone()
        return result is not None
    except Exception:
        return False


def _vector_col():
    """Return appropriate column definition depending on pgvector availability."""
    if _pgvector_available():
        from pgvector.sqlalchemy import Vector
        return sa.Column("vector", Vector(384))
    # Fallback: store as nullable text (embeddings disabled)
    return sa.Column("vector", sa.Text, nullable=True)

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "memoryweb"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # pgvector already attempted (and possibly skipped) in env.py

    # sources
    op.create_table(
        "sources",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_path", sa.Text, nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger, nullable=True),
        sa.Column("message_count", sa.Integer, nullable=True),
        sa.Column("ingested_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("last_checked_at", sa.DateTime, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.UniqueConstraint("source_hash", name="uq_sources_hash"),
        schema=SCHEMA,
    )

    # conversations
    op.create_table(
        "conversations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("participant", sa.String(100), nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("ended_at", sa.DateTime, nullable=True),
        sa.Column("message_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("ix_conversations_source", "conversations", ["source_id"], schema=SCHEMA)
    op.create_index("ix_conversations_external", "conversations", ["external_id"], schema=SCHEMA)

    # messages
    op.create_table(
        "messages",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordinal", sa.Integer, nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("raw_json", JSONB, nullable=True),
        sa.Column("external_uuid", sa.String(255), nullable=True),
        sa.Column("char_offset_start", sa.BigInteger, nullable=True),
        sa.Column("char_offset_end", sa.BigInteger, nullable=True),
        sa.Column("sent_at", sa.DateTime, nullable=True),
        sa.Column("token_count", sa.Integer, nullable=True),
        sa.Column("tombstoned_at", sa.DateTime, nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_messages_conv_ordinal", "messages", ["conversation_id", "ordinal"], schema=SCHEMA)
    op.create_index("ix_messages_ext_uuid", "messages", ["external_uuid"], schema=SCHEMA)

    # segments
    op.create_table(
        "segments",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_message_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.messages.id"), nullable=False),
        sa.Column("end_message_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.messages.id"), nullable=False),
        sa.Column("start_ordinal", sa.Integer, nullable=False),
        sa.Column("end_ordinal", sa.Integer, nullable=False),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("message_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("tombstoned_at", sa.DateTime, nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_segments_conv", "segments", ["conversation_id"], schema=SCHEMA)

    # tag_axes
    op.create_table(
        "tag_axes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("axis_name", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.UniqueConstraint("axis_name", name="uq_tag_axes_name"),
        schema=SCHEMA,
    )

    # tags
    op.create_table(
        "tags",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("segment_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.segments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("axis_id", sa.Integer, sa.ForeignKey(f"{SCHEMA}.tag_axes.id"), nullable=False),
        sa.Column("value", sa.String(200), nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("ix_tags_segment_axis", "tags", ["segment_id", "axis_id"], schema=SCHEMA)

    # entities
    op.create_table(
        "entities",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("canonical_name", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("canonical_name", "entity_type", name="uq_entities_canonical"),
        schema=SCHEMA,
    )
    op.execute(
        f"CREATE INDEX ix_{SCHEMA}_entities_trgm ON {SCHEMA}.entities USING gin (name gin_trgm_ops)"
    )

    # entity_mentions
    op.create_table(
        "entity_mentions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("entity_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("segment_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.segments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("message_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.messages.id", ondelete="CASCADE"), nullable=True),
        sa.Column("char_start", sa.Integer, nullable=True),
        sa.Column("char_end", sa.Integer, nullable=True),
        sa.Column("context_snippet", sa.Text, nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_entity_mentions_segment", "entity_mentions", ["segment_id"], schema=SCHEMA)
    op.create_index("ix_entity_mentions_message", "entity_mentions", ["message_id"], schema=SCHEMA)

    # memories
    op.create_table(
        "memories",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("fact", sa.Text, nullable=False),
        sa.Column("fact_hash", sa.String(64), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("importance", sa.SmallInteger, nullable=True),
        sa.Column("access_count", sa.Integer, default=0),
        sa.Column("last_accessed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("tombstoned_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("fact_hash", name="uq_memories_fact_hash"),
        schema=SCHEMA,
    )
    op.execute(
        f"CREATE INDEX ix_{SCHEMA}_memories_trgm ON {SCHEMA}.memories USING gin (fact gin_trgm_ops)"
    )

    # memory_provenance
    op.create_table(
        "memory_provenance",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("memory_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.memories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("segment_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.segments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("derivation_type", sa.String(50), nullable=False, server_default="extracted"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("ix_memory_provenance_memory", "memory_provenance", ["memory_id"], schema=SCHEMA)
    op.create_index("ix_memory_provenance_source", "memory_provenance", ["source_id"], schema=SCHEMA)

    # memory_links
    op.create_table(
        "memory_links",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("memory_id_a", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.memories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory_id_b", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.memories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_type", sa.String(50), nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("memory_id_a", "memory_id_b", "link_type", name="uq_memory_links"),
        schema=SCHEMA,
    )

    # embeddings  (pgvector 384-dim if available, else Text placeholder)
    op.create_table(
        "embeddings",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.BigInteger, nullable=False),
        _vector_col(),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("ix_embeddings_target", "embeddings", ["target_type", "target_id"], schema=SCHEMA)
    # IVFFlat index for cosine similarity (created after data load for efficiency)
    # op.execute(f"CREATE INDEX ON {SCHEMA}.embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100)")

    # retention_log
    op.create_table(
        "retention_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_ids", JSONB, nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("triggered_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("reversed_at", sa.DateTime, nullable=True),
        schema=SCHEMA,
    )

    # pipeline_runs
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.BigInteger, sa.ForeignKey(f"{SCHEMA}.sources.id", ondelete="CASCADE"), nullable=True),
        sa.Column("stage", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("records_processed", sa.Integer, default=0),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("ix_pipeline_runs_source", "pipeline_runs", ["source_id"], schema=SCHEMA)

    # Seed tag axes
    op.execute(f"""
        INSERT INTO {SCHEMA}.tag_axes (axis_name, description) VALUES
        ('domain', 'Subject domain: infrastructure, ml, web, database, security, etc.'),
        ('intent', 'Conversation intent: debugging, planning, implementation, learning, review'),
        ('sensitivity', 'Data sensitivity: public, internal, confidential, pii'),
        ('importance', 'Importance level: low, medium, high, critical'),
        ('project', 'Associated project name or identifier')
    """)


def downgrade() -> None:
    SCHEMA = "memoryweb"
    for table in [
        "pipeline_runs", "retention_log", "embeddings", "memory_links",
        "memory_provenance", "memories", "entity_mentions", "entities",
        "tags", "tag_axes", "segments", "messages", "conversations", "sources",
    ]:
        op.drop_table(table, schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
