"""Thin HTTP client for the local Mira (Competitor Intelligence) API."""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_BASE = "http://localhost:4000"


def _base() -> str:
    return (os.getenv("MIRA_API_BASE") or DEFAULT_BASE).rstrip("/")


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


async def mira_get(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{_base()}/api{path}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.get(url, headers=_headers(), params=params)
        res.raise_for_status()
        return res.json()


async def mira_post(path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"{_base()}/api{path}"
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(url, headers=_headers(), json=body or {})
        res.raise_for_status()
        return res.json()
