"""Upgrade embeddings.vector column to pgvector type when extension available

Revision ID: 002
Revises: 001
Create Date: 2026-02-28
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

SCHEMA = "memoryweb"


def _pgvector_available():
    try:
        conn = op.get_bind()
        result = conn.execute(
            sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        ).fetchone()
        return result is not None
    except Exception:
        return False


def upgrade() -> None:
    if not _pgvector_available():
        # pgvector not installed yet — skip, re-run after installing
        print("pgvector not available — skipping vector column upgrade. Re-run after: CREATE EXTENSION vector;")
        return

    # pgvector is available: try to install it in case it wasn't done before
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except Exception:
        pass

    # Check current column type
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_schema='memoryweb' AND table_name='embeddings' AND column_name='vector'"
    )).fetchone()

    if result and result[0] == "text":
        # Column is still Text — upgrade it
        # First delete existing text embeddings (they'll be re-generated)
        op.execute(f"DELETE FROM {SCHEMA}.embeddings")
        # Drop the text column and add a proper vector column
        op.drop_column("embeddings", "vector", schema=SCHEMA)
        from pgvector.sqlalchemy import Vector
        op.add_column(
            "embeddings",
            sa.Column("vector", Vector(384), nullable=True),
            schema=SCHEMA,
        )
        # Recreate the IVFFlat index (need at least 1 row, so just create structure)
        print("Vector column upgraded. Re-run embed_memories() and embed_segments() to populate.")
    elif result and result[0] != "text":
        print(f"Vector column already has type '{result[0]}' — no upgrade needed.")


def downgrade() -> None:
    # Convert back to text fallback
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_schema='memoryweb' AND table_name='embeddings' AND column_name='vector'"
    )).fetchone()
    if result and result[0] != "text":
        op.execute(f"DELETE FROM {SCHEMA}.embeddings")
        op.drop_column("embeddings", "vector", schema=SCHEMA)
        op.add_column(
            "embeddings",
            sa.Column("vector", sa.Text, nullable=True),
            schema=SCHEMA,
        )
