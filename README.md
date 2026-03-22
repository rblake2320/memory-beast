# Memory Beast

**Provenance-aware memory infrastructure for AI agents and teams.**

Memory Beast remembers what your AI system knows, where it learned it, and when that changed — with tamper-evident audit trails and per-tenant isolation.

## What it does

- **Remembers facts** from conversations, documents, and observations
- **Tracks provenance** — every memory links back to its source
- **Detects contradictions** and propagates stale-answer warnings
- **Answers certificates** — every query response is hash-stamped so you can audit "what did the system know on March 15?"
- **MINJA defense** — 10-layer poisoning detection guards against adversarial injection
- **Multi-tenant** — PostgreSQL RLS isolation, per-tenant hash chains

## Architecture

```
memory-beast/
├── backend/    # FastAPI + Celery + PostgreSQL (MemoryWeb engine)
└── frontend/   # React 19 + TypeScript + Tailwind 4 SPA
```

## Quick Start (Self-Hosted)

```bash
# 1. Clone
git clone https://github.com/rblake2320/memory-beast.git
cd memory-beast

# 2. Configure
cp .env.example .env
# Edit .env — set MW_DATABASE_URL, MW_REDIS_URL, MW_OLLAMA_BASE_URL

# 3. Run (Docker)
docker compose up -d

# 4. Apply migrations
docker compose exec backend alembic upgrade head

# 5. Open
open http://localhost:8100
```

## Editions

| Feature | Community | Pro |
|---------|-----------|-----|
| 3-tier retrieval | ✓ | ✓ |
| Answer certificates | ✓ | ✓ |
| Event log chain | ✓ | ✓ |
| Contradiction detection | ✓ | ✓ |
| Multi-tenant (self-hosted) | ✓ | ✓ |
| Data export connectors | — | ✓ |
| Custom embeddings | — | ✓ |
| Admin analytics | — | ✓ |
| Multi-instance orchestration | — | ✓ |
| Managed hosting | — | ✓ |

Community is free forever. Pro at [memorybeast.app/pricing](https://memorybeast.app/pricing).

## License

MIT — use it, fork it, host it yourself.
The license server and managed hosting are proprietary.
