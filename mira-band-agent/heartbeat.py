"""Ping Mira API so the Ask Mira UI can show Band agents as online."""

from __future__ import annotations

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)


def _base() -> str:
    return (os.getenv("MIRA_API_BASE") or "http://localhost:4000").rstrip("/")


def _headers() -> dict[str, str]:
    token = os.getenv("MIRA_API_TOKEN") or "dev-bypass"
    workspace = os.getenv("MIRA_WORKSPACE_ID") or ""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if workspace:
        headers["X-Workspace-Id"] = str(workspace)
    return headers


async def heartbeat_loop(agent_id: str, interval_sec: float = 15.0) -> None:
    """Background task: mark this Band agent online in Mira."""
    url = f"{_base()}/api/analyst/agents/heartbeat"
    payload = {"id": agent_id, "source": "band", "pid": os.getpid()}
    while True:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=_headers(), json=payload)
                if res.status_code >= 400:
                    logger.warning("heartbeat %s → %s %s", agent_id, res.status_code, res.text[:200])
                else:
                    logger.debug("heartbeat ok: %s", agent_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("heartbeat %s failed: %s", agent_id, exc)
        await asyncio.sleep(interval_sec)
