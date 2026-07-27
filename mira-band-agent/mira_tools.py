"""Custom Band tools that call the Mira API (localhost in local tests)."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from mira_api import mira_get, mira_post

logger = logging.getLogger(__name__)


def _clip(data: Any, limit: int = 12000) -> str:
    return json.dumps(data, default=str)[:limit]


class ListCompetitorsInput(BaseModel):
    """List competitors tracked in the Mira workspace (optional status filter)."""

    status: str | None = Field(
        default=None,
        description="Optional status filter, e.g. approved or pending",
    )


async def list_competitors(inp: ListCompetitorsInput) -> str:
    params = {"status": inp.status} if inp.status else None
    data = await mira_get("/competitors", params=params)
    rows = data.get("competitors") or data.get("data") or data
    return _clip(rows)


class ListChangesInput(BaseModel):
    """List recent competitor changes / alerts from Mira."""

    limit: int = Field(default=20, description="Max changes to return (1-50)")


async def list_changes(inp: ListChangesInput) -> str:
    limit = max(1, min(50, int(inp.limit or 20)))
    data = await mira_get("/changes", params={"limit": limit})
    return _clip(data)


class GetProductInput(BaseModel):
    """Get the founder's product profile saved in Mira."""

    unused: str | None = Field(default=None, description="Unused; leave empty")


async def get_product(_inp: GetProductInput) -> str:
    data = await mira_get("/products")
    return _clip(data)


class AnalystTakeInput(BaseModel):
    """Run Mira's analyst-take endpoint for a short strategic read."""

    unused: str | None = Field(default=None, description="Unused; leave empty")


async def analyst_take(_inp: AnalystTakeInput) -> str:
    try:
        data = await mira_post("/intelligence/analyst-take")
    except Exception as exc:  # noqa: BLE001
        logger.warning("analyst_take failed: %s", exc)
        return _clip({"error": str(exc)})
    return _clip(data)


class GetPositioningInput(BaseModel):
    """Run Mira positioning analysis across approved competitors."""

    unused: str | None = Field(default=None, description="Unused; leave empty")


async def get_positioning(_inp: GetPositioningInput) -> str:
    try:
        data = await mira_post("/intelligence/positioning")
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_positioning failed: %s", exc)
        return _clip({"error": str(exc)})
    return _clip(data, 14000)


class GetMarketPulseInput(BaseModel):
    """Fetch latest market pulse (distribution snapshot + recent pricing moves)."""

    unused: str | None = Field(default=None, description="Unused; leave empty")


async def get_market_pulse(_inp: GetMarketPulseInput) -> str:
    try:
        data = await mira_get("/intelligence/market-pulse")
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_market_pulse failed: %s", exc)
        return _clip({"error": str(exc)})
    return _clip(data, 14000)


class GetMarketModelInput(BaseModel):
    """Fetch the saved market model (TAM/SAM/SOM-style) if one exists."""

    unused: str | None = Field(default=None, description="Unused; leave empty")


async def get_market_model(_inp: GetMarketModelInput) -> str:
    try:
        data = await mira_get("/intelligence/market-model")
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_market_model failed: %s", exc)
        return _clip({"error": str(exc)})
    return _clip(data, 14000)


class GetBattlecardInput(BaseModel):
    """Generate a battlecard for one tracked competitor by id or exact name."""

    competitor_id: str | None = Field(default=None, description="Competitor UUID if known")
    competitor_name: str | None = Field(
        default=None,
        description="Exact competitor name if id unknown (case-insensitive match)",
    )


async def get_battlecard(inp: GetBattlecardInput) -> str:
    cid = (inp.competitor_id or "").strip()
    if not cid and inp.competitor_name:
        listed = await mira_get("/competitors", params={"status": "approved"})
        rows = listed.get("competitors") or listed.get("data") or listed or []
        needle = inp.competitor_name.strip().lower()
        match = next(
            (r for r in rows if str(r.get("name") or "").strip().lower() == needle),
            None,
        )
        if not match:
            # soft match contains
            match = next(
                (r for r in rows if needle in str(r.get("name") or "").lower()),
                None,
            )
        if not match:
            return _clip({"error": f"No competitor named '{inp.competitor_name}'"})
        cid = str(match.get("id"))

    if not cid:
        return _clip({"error": "Provide competitor_id or competitor_name"})

    try:
        data = await mira_post(f"/intelligence/competitors/{cid}/battlecard")
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_battlecard failed: %s", exc)
        return _clip({"error": str(exc)})
    return _clip(data, 14000)


class LookupPeersHintInput(BaseModel):
    """Reminder of which Band peers to invite for a topic."""

    note: str = Field(
        default="Invite specialist agents when the question needs them.",
        description="Reminder text",
    )


async def lookup_peers_hint(inp: LookupPeersHintInput) -> str:
    return (
        "Use Band peer tools to find/invite agents by display name when helpful:\n"
        "- Pricing — tiers, $/mo, overpriced vs value\n"
        "- Watch — what changed recently / alerts\n"
        "- Positioning — landscape, gaps, exposure\n"
        "- Market — market pulse / TAM-SAM-SOM model\n"
        f"Note: {inp.note}"
    )


# Shared building blocks
_COMPETITORS = (ListCompetitorsInput, list_competitors)
_CHANGES = (ListChangesInput, list_changes)
_PRODUCT = (GetProductInput, get_product)
_ANALYST = (AnalystTakeInput, analyst_take)
_POSITIONING = (GetPositioningInput, get_positioning)
_PULSE = (GetMarketPulseInput, get_market_pulse)
_MODEL = (GetMarketModelInput, get_market_model)
_BATTLECARD = (GetBattlecardInput, get_battlecard)
_PEERS = (LookupPeersHintInput, lookup_peers_hint)

MIRA_TOOLS: list[tuple[type[BaseModel], Any]] = [
    _COMPETITORS,
    _CHANGES,
    _PRODUCT,
    _ANALYST,
    _PEERS,
]

PRICING_TOOLS: list[tuple[type[BaseModel], Any]] = [
    _COMPETITORS,
    _CHANGES,
]

WATCH_TOOLS: list[tuple[type[BaseModel], Any]] = [
    _CHANGES,
    _COMPETITORS,
]

POSITIONING_TOOLS: list[tuple[type[BaseModel], Any]] = [
    _COMPETITORS,
    _PRODUCT,
    _POSITIONING,
    _BATTLECARD,
]

MARKET_TOOLS: list[tuple[type[BaseModel], Any]] = [
    _PULSE,
    _MODEL,
    _COMPETITORS,
    _CHANGES,
]
