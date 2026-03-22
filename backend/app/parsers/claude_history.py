"""
Parse Claude history.jsonl (prompt/response log, 2,486 entries).

Typical format per line:
{
  "prompt": "...",
  "response": "...",
  "timestamp": "...",
  "model": "...",
  "session_id": "..."
}

or simple {"role": "user", "content": "..."} pairs.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterator, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class HistoryEntry:
    ordinal: int
    prompt: str
    response: Optional[str]
    sent_at: Optional[datetime]
    model: Optional[str]
    session_id: Optional[str]
    raw_json: dict
    char_offset_start: int
    char_offset_end: int


def parse_history_file(path: str) -> List[HistoryEntry]:
    """Parse a history.jsonl file into a list of HistoryEntry objects."""
    p = Path(path)
    entries: List[HistoryEntry] = []
    offset = 0
    ordinal = 0

    try:
        with open(p, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line_start = offset
                offset += len(line.encode("utf-8"))
                line = line.strip()
                if not line:
                    continue

                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("Skipping bad JSON in history file %s", path)
                    continue

                prompt = record.get("prompt", record.get("content", ""))
                response = record.get("response")
                ts_raw = record.get("timestamp")
                sent_at = None
                if ts_raw:
                    try:
                        sent_at = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                entries.append(HistoryEntry(
                    ordinal=ordinal,
                    prompt=str(prompt),
                    response=str(response) if response else None,
                    sent_at=sent_at,
                    model=record.get("model"),
                    session_id=record.get("session_id"),
                    raw_json=record,
                    char_offset_start=line_start,
                    char_offset_end=offset,
                ))
                ordinal += 1
    except OSError as e:
        logger.error("Cannot open history file %s: %s", path, e)
        raise

    return entries
