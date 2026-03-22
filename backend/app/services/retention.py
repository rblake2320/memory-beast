"""
Retention controls: tombstoning, restore, hard-delete (purge).

Tombstones cascade: messages → segments → memories (only if ALL provenance tombstoned).
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import db_session
from ..models import (
    Conversation, Memory, MemoryProvenance, Message, RetentionLog, Segment, Tag,
)

logger = logging.getLogger(__name__)

NOW = datetime.utcnow


def _log_action(
    db: Session,
    action: str,
    target_type: str,
    affected_ids: List[int],
    reason: Optional[str] = None,
) -> None:
    log = RetentionLog(
        action=action,
        target_type=target_type,
        target_ids={"ids": affected_ids},
        reason=reason,
        triggered_by="api",
    )
    db.add(log)


def _cascade_memory_tombstone(db: Session) -> int:
    """
    Tombstone memories where ALL provenance links point to tombstoned segments/messages.
    Returns count of newly tombstoned memories.
    """
    # Find memories where every provenance link has a tombstoned segment
    count = 0
    active_memories = db.query(Memory).filter(Memory.tombstoned_at.is_(None)).all()

    for mem in active_memories:
        provs = db.query(MemoryProvenance).filter(
            MemoryProvenance.memory_id == mem.id
        ).all()
        if not provs:
            continue

        all_tombstoned = True
        for prov in provs:
            if prov.segment_id:
                seg = db.query(Segment).get(prov.segment_id)
                if seg and seg.tombstoned_at is None:
                    all_tombstoned = False
                    break
        if all_tombstoned:
            mem.tombstoned_at = NOW()
            count += 1

    return count


def tombstone_by_date(date_str: str, reason: Optional[str] = None) -> dict:
    """Tombstone all messages/segments/memories for a given date (YYYY-MM-DD)."""
    try:
        day = datetime.strptime(date_str, "%Y-%m-%d")
        day_end = day + timedelta(days=1)
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str} (expected YYYY-MM-DD)")

    with db_session() as db:
        # Tombstone messages
        msgs = (
            db.query(Message)
            .filter(Message.sent_at >= day, Message.sent_at < day_end, Message.tombstoned_at.is_(None))
            .all()
        )
        msg_ids = []
        for m in msgs:
            m.tombstoned_at = NOW()
            msg_ids.append(m.id)

        # Tombstone segments that overlap with those messages
        seg_ids = list({m.conversation_id for m in msgs})  # conv ids
        segs = (
            db.query(Segment)
            .filter(Segment.conversation_id.in_(seg_ids), Segment.tombstoned_at.is_(None))
            .all()
        )
        actual_seg_ids = []
        for s in segs:
            s.tombstoned_at = NOW()
            actual_seg_ids.append(s.id)

        mem_count = _cascade_memory_tombstone(db)

        _log_action(db, "tombstone", "date", msg_ids, reason=reason or f"date={date_str}")

    return {
        "date": date_str,
        "messages_tombstoned": len(msg_ids),
        "segments_tombstoned": len(actual_seg_ids),
        "memories_tombstoned": mem_count,
    }


def tombstone_by_domain(domain: str, reason: Optional[str] = None) -> dict:
    """Tombstone all segments/memories with domain tag matching domain."""
    from ..models import TagAxis, Tag
    with db_session() as db:
        axis = db.query(TagAxis).filter(TagAxis.axis_name == "domain").first()
        if not axis:
            return {"error": "domain axis not found"}

        seg_ids = [
            t.segment_id for t in db.query(Tag)
            .filter(Tag.axis_id == axis.id, Tag.value == domain)
            .all()
        ]

        segs = db.query(Segment).filter(
            Segment.id.in_(seg_ids), Segment.tombstoned_at.is_(None)
        ).all()
        tombstoned_seg_ids = []
        for s in segs:
            s.tombstoned_at = NOW()
            tombstoned_seg_ids.append(s.id)

        mem_count = _cascade_memory_tombstone(db)
        _log_action(db, "tombstone", "domain", tombstoned_seg_ids, reason=reason or f"domain={domain}")

    return {
        "domain": domain,
        "segments_tombstoned": len(tombstoned_seg_ids),
        "memories_tombstoned": mem_count,
    }


def tombstone_conversation(conversation_id: int, reason: Optional[str] = None) -> dict:
    """Tombstone all messages, segments, and memories for a conversation."""
    with db_session() as db:
        # Messages
        msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.tombstoned_at.is_(None)
        ).all()
        for m in msgs:
            m.tombstoned_at = NOW()

        # Segments
        segs = db.query(Segment).filter(
            Segment.conversation_id == conversation_id,
            Segment.tombstoned_at.is_(None)
        ).all()
        seg_ids = []
        for s in segs:
            s.tombstoned_at = NOW()
            seg_ids.append(s.id)

        mem_count = _cascade_memory_tombstone(db)
        _log_action(db, "tombstone", "conversation", [conversation_id], reason=reason)

    return {
        "conversation_id": conversation_id,
        "messages_tombstoned": len(msgs),
        "segments_tombstoned": len(seg_ids),
        "memories_tombstoned": mem_count,
    }


def restore(target_type: str, target_id: int) -> dict:
    """Un-tombstone a message, segment, memory, or entire conversation."""
    with db_session() as db:
        if target_type == "conversation":
            msg_count = (db.query(Message)
                         .filter(Message.conversation_id == target_id,
                                 Message.tombstoned_at.isnot(None))
                         .update({"tombstoned_at": None}))
            seg_count = (db.query(Segment)
                         .filter(Segment.conversation_id == target_id,
                                 Segment.tombstoned_at.isnot(None))
                         .update({"tombstoned_at": None}))
            # Restore memories whose provenance links to this conversation's segments
            seg_ids = [r.id for r in db.query(Segment.id)
                       .filter(Segment.conversation_id == target_id).all()]
            mem_ids_to_restore = set()
            for prov in db.query(MemoryProvenance).filter(
                MemoryProvenance.segment_id.in_(seg_ids)
            ).all():
                mem_ids_to_restore.add(prov.memory_id)
            mem_count = 0
            if mem_ids_to_restore:
                mem_count = (db.query(Memory)
                             .filter(Memory.id.in_(mem_ids_to_restore),
                                     Memory.tombstoned_at.isnot(None))
                             .update({"tombstoned_at": None}))
            _log_action(db, "restore", target_type, [target_id])
            return {
                "restored": True, "target_type": target_type,
                "target_id": target_id,
                "messages_restored": msg_count,
                "segments_restored": seg_count,
                "memories_restored": mem_count,
            }
        elif target_type == "message":
            obj = db.query(Message).get(target_id)
        elif target_type == "segment":
            obj = db.query(Segment).get(target_id)
        elif target_type == "memory":
            obj = db.query(Memory).get(target_id)
        else:
            return {"error": f"Unknown target_type: {target_type}"}

        if not obj:
            return {"error": f"{target_type} {target_id} not found"}

        obj.tombstoned_at = None
        _log_action(db, "restore", target_type, [target_id])

    return {"restored": True, "target_type": target_type, "target_id": target_id}


def purge_tombstoned(older_than_days: int = 30, dry_run: bool = True) -> dict:
    """Hard-delete tombstoned records older than N days."""
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)

    with db_session() as db:
        # Count first
        msg_q = db.query(Message).filter(
            Message.tombstoned_at.isnot(None),
            Message.tombstoned_at < cutoff
        )
        seg_q = db.query(Segment).filter(
            Segment.tombstoned_at.isnot(None),
            Segment.tombstoned_at < cutoff
        )
        mem_q = db.query(Memory).filter(
            Memory.tombstoned_at.isnot(None),
            Memory.tombstoned_at < cutoff
        )

        counts = {
            "messages": msg_q.count(),
            "segments": seg_q.count(),
            "memories": mem_q.count(),
        }

        if not dry_run:
            msg_q.delete(synchronize_session=False)
            seg_q.delete(synchronize_session=False)
            mem_q.delete(synchronize_session=False)
            _log_action(db, "purge", "all", [], reason=f"older_than_days={older_than_days}")

    return {
        "dry_run": dry_run,
        "older_than_days": older_than_days,
        "would_delete": counts if dry_run else {},
        "deleted": counts if not dry_run else {},
    }


def list_tombstoned(limit: int = 100) -> dict:
    """Return counts of tombstoned records."""
    with db_session() as db:
        return {
            "messages": db.query(Message).filter(Message.tombstoned_at.isnot(None)).count(),
            "segments": db.query(Segment).filter(Segment.tombstoned_at.isnot(None)).count(),
            "memories": db.query(Memory).filter(Memory.tombstoned_at.isnot(None)).count(),
        }
