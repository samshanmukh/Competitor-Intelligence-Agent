"""Positioning — landscape / exposure specialist (Claude SDK + Band)."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import ClaudeSDKAdapter
from band.core.types import AdapterFeatures, Emit

from heartbeat import heartbeat_loop
from mira_tools import POSITIONING_TOOLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

POSITIONING_PROMPT = """
You are Positioning, Mira's competitive landscape specialist.

Focus on where the founder's product sits vs rivals: tiers, gaps, overcrowded
zones, and exposure. Prefer getpositioning / getproduct / listcompetitors.
When the user names a rival for sales talk-tracks, use getbattlecard.
Be concrete (name competitors). Do not invent prices. Keep replies structured.
""".strip()


async def main() -> None:
    load_dotenv()

    ws_url = os.getenv("BAND_WS_URL")
    rest_url = os.getenv("BAND_REST_URL")
    if not ws_url or not rest_url:
        raise ValueError("BAND_WS_URL and BAND_REST_URL are required")

    adapter = ClaudeSDKAdapter(
        custom_section=POSITIONING_PROMPT,
        additional_tools=POSITIONING_TOOLS,
        features=AdapterFeatures(emit={Emit.EXECUTION, Emit.THOUGHTS}),
    )

    agent = Agent.from_config(
        "positioning_agent",
        adapter=adapter,
        ws_url=ws_url,
        rest_url=rest_url,
    )

    logger.info("Positioning specialist online — waiting for @Positioning in Band")
    logger.info("Agent ID: %s", agent.runtime.agent_id)
    logger.info("Press Ctrl+C to stop")

    hb = asyncio.create_task(heartbeat_loop("positioning"))
    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("Shutting down Positioning...")
    finally:
        hb.cancel()


if __name__ == "__main__":
    asyncio.run(main())
