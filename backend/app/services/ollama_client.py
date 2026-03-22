"""Thin httpx wrapper for Ollama API (synchronous)."""

import json
import logging
from typing import Any, Dict, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            base_url=settings.MW_OLLAMA_BASE_URL,
            timeout=httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=5.0),
        )
    return _client


def generate(
    prompt: str,
    model: Optional[str] = None,
    system: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 2048,
) -> str:
    """Call Ollama /api/generate, return the response text."""
    client = _get_client()
    payload: Dict[str, Any] = {
        "model": model or settings.MW_OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    if system:
        payload["system"] = system

    try:
        resp = client.post("/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip()
    except httpx.HTTPStatusError as e:
        logger.error("Ollama HTTP error: %s", e)
        raise
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        raise


def generate_json(
    prompt: str,
    model: Optional[str] = None,
    system: Optional[str] = None,
    temperature: float = 0.1,
) -> Any:
    """Call Ollama and parse response as JSON. Returns parsed object."""
    client = _get_client()
    payload: Dict[str, Any] = {
        "model": model or settings.MW_OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": temperature,
            "num_predict": 4096,
        },
    }
    if system:
        payload["system"] = system

    try:
        resp = client.post("/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        raw = data.get("response", "").strip()
        return json.loads(raw)
    except (json.JSONDecodeError, httpx.HTTPStatusError) as e:
        logger.error("Ollama JSON generation failed: %s", e)
        raise


def is_available() -> bool:
    """Quick health check against Ollama."""
    try:
        client = _get_client()
        resp = client.get("/api/tags", timeout=5.0)
        return resp.status_code == 200
    except Exception:
        return False
