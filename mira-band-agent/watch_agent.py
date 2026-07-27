"""Watch — competitor change / alerts specialist (Claude SDK + Band)."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import ClaudeSDKAdapter
from band.core.types import AdapterFeatures, Emit

from heartbeat import heartbeat_loop
from mira_tools import WATCH_TOOLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WATCH_PROMPT = """
You are Watch, Mira's change-detection specialist.

Focus on what moved recently among tracked competitors: pricing page edits,
plan renames, new tiers, messaging shifts. Use listchanges and listcompetitors.
Be chronological and specific (who / what / when). Flag anything that looks
urgent for the founder. Keep replies short; hand strategy back to Mira.
""".strip()


async def main() -> None:
    load_dotenv()

    ws_url = os.getenv("BAND_WS_URL")
    rest_url = os.getenv("BAND_REST_URL")
    if not ws_url or not rest_url:
        raise ValueError("BAND_WS_URL and BAND_REST_URL are required")

    adapter = ClaudeSDKAdapter(
        custom_section=WATCH_PROMPT,
        additional_tools=WATCH_TOOLS,
        features=AdapterFeatures(emit={Emit.EXECUTION, Emit.THOUGHTS}),
    )

    agent = Agent.from_config(
        "watch_agent",
        adapter=adapter,
        ws_url=ws_url,
        rest_url=rest_url,
    )

    logger.info("Watch specialist online — waiting for @Watch in Band")
    logger.info("Agent ID: %s", agent.runtime.agent_id)
    logger.info("Press Ctrl+C to stop")

    hb = asyncio.create_task(heartbeat_loop("watch"))
    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("Shutting down Watch...")
    finally:
        hb.cancel()


if __name__ == "__main__":
    asyncio.run(main())
