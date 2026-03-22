"""
Import existing SQLite FTS5 memory database.

Tables:
- journal_entries: text, created_at, category, ...
- knowledge_items: content, source, topic, ...
"""

import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Iterator, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class JournalEntry:
    rowid: int
    text: str
    category: Optional[str]
    created_at: Optional[datetime]
    raw: dict


@dataclass
class KnowledgeItem:
    rowid: int
    content: str
    source: Optional[str]
    topic: Optional[str]
    created_at: Optional[datetime]
    raw: dict


def _parse_dt(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None


def _find_table(cur, candidates: list) -> Optional[str]:
    """Return the first existing table name from the candidates list."""
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing = {r[0] for r in cur.fetchall()}
    for name in candidates:
        if name in existing:
            return name
    return None


def import_journal_entries(db_path: str) -> List[JournalEntry]:
    entries = []
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        table = _find_table(cur, ["journal_entries", "journal", "entries", "messages"])
        if not table:
            logger.warning("No journal table found in %s", db_path)
            conn.close()
            return []

        cur.execute(f"SELECT * FROM {table}")
        for row in cur.fetchall():
            d = dict(row)
            text = (
                d.get("text")
                or d.get("content")
                or d.get("body")
                or d.get("entry")
                or ""
            )
            entries.append(JournalEntry(
                rowid=d.get("id") or d.get("rowid", 0),
                text=str(text),
                category=d.get("category") or d.get("type") or d.get("role"),
                created_at=_parse_dt(d.get("created_at") or d.get("timestamp")),
                raw=d,
            ))
        conn.close()
    except sqlite3.OperationalError as e:
        logger.error("SQLite journal error in %s: %s", db_path, e)

    return entries


def import_knowledge_items(db_path: str) -> List[KnowledgeItem]:
    items = []
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        table = _find_table(cur, ["knowledge_items", "knowledge", "facts", "memories"])
        if not table:
            logger.warning("No knowledge table found in %s", db_path)
            conn.close()
            return []

        cur.execute(f"SELECT * FROM {table}")
        for row in cur.fetchall():
            d = dict(row)
            # knowledge table: problem + solution concatenated as content
            content = (
                d.get("content")
                or d.get("text")
                or d.get("value")
                or (
                    (d.get("problem", "") + "\n" + d.get("solution", "")).strip()
                    if d.get("problem")
                    else ""
                )
                or ""
            )
            items.append(KnowledgeItem(
                rowid=d.get("id") or d.get("rowid", 0),
                content=str(content),
                source=d.get("source"),
                topic=d.get("topic") or d.get("category") or d.get("tags"),
                created_at=_parse_dt(d.get("created_at") or d.get("created") or d.get("timestamp")),
                raw=d,
            ))
        conn.close()
    except sqlite3.OperationalError as e:
        logger.error("SQLite knowledge error in %s: %s", db_path, e)

    return items


def list_tables(db_path: str) -> List[str]:
    """Return all table names in the SQLite database."""
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cur.fetchall()]
        conn.close()
        return tables
    except sqlite3.Error:
        return []
