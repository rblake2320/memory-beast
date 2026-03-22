"""
Parse AI Army shared chat markdown files.

Format:
# [FROM: X] [TO: Y]
**Time:** 2025-01-01 00:00:00
**Subject:** Some subject

Message body here...
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

logger = logging.getLogger(__name__)

_HEADER_RE = re.compile(
    r"#\s+\[FROM:\s*(?P<from_>\S+)\]\s+\[TO:\s*(?P<to_>\S+)\]",
    re.IGNORECASE,
)
_TIME_RE = re.compile(r"\*\*Time:\*\*\s*(?P<ts>.+)", re.IGNORECASE)
_SUBJECT_RE = re.compile(r"\*\*Subject:\*\*\s*(?P<subject>.+)", re.IGNORECASE)


@dataclass
class SharedChatMessage:
    from_agent: str
    to_agent: str
    subject: Optional[str]
    body: str
    sent_at: Optional[datetime]
    source_path: str


def parse_shared_chat_file(path: str) -> Optional[SharedChatMessage]:
    """Parse a single shared chat .md file. Returns None if unparseable."""
    p = Path(path)
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        logger.warning("Cannot read shared chat file %s: %s", path, e)
        return None

    lines = text.splitlines()
    if not lines:
        return None

    from_agent = "unknown"
    to_agent = "unknown"
    sent_at = None
    subject = None
    body_lines = []
    in_body = False

    for line in lines:
        if not in_body:
            m = _HEADER_RE.match(line)
            if m:
                from_agent = m.group("from_").strip()
                to_agent = m.group("to_").strip()
                continue

            m = _TIME_RE.match(line)
            if m:
                ts_raw = m.group("ts").strip()
                try:
                    sent_at = datetime.fromisoformat(ts_raw)
                except ValueError:
                    try:
                        from dateutil import parser as dp
                        sent_at = dp.parse(ts_raw)
                    except Exception:
                        pass
                continue

            m = _SUBJECT_RE.match(line)
            if m:
                subject = m.group("subject").strip()
                in_body = True
                continue

            # If we hit a blank line after headers, start body
            if line.strip() == "" and from_agent != "unknown":
                in_body = True
        else:
            body_lines.append(line)

    body = "\n".join(body_lines).strip()
    if not body and not subject:
        # Treat entire file as body
        body = text.strip()

    return SharedChatMessage(
        from_agent=from_agent,
        to_agent=to_agent,
        subject=subject,
        body=body,
        sent_at=sent_at,
        source_path=str(p),
    )


def iter_shared_chat_files(directory: str) -> Iterator[Path]:
    """Yield all .md files in the shared chat directory."""
    d = Path(directory)
    if not d.exists():
        logger.warning("Shared chat directory not found: %s", directory)
        return
    for f in sorted(d.rglob("*.md")):
        yield f


def batch_parse_shared_chat(
    directory: str, batch_size: int = 500
) -> Iterator[List[SharedChatMessage]]:
    """Yield batches of parsed SharedChatMessage objects."""
    batch: List[SharedChatMessage] = []
    for path in iter_shared_chat_files(directory):
        msg = parse_shared_chat_file(str(path))
        if msg:
            batch.append(msg)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch
