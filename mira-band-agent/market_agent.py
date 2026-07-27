"""Market — market pulse / model specialist (Claude SDK + Band)."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import ClaudeSDKAdapter
from band.core.types import AdapterFeatures, Emit

from heartbeat import heartbeat_loop
from mira_tools import MARKET_TOOLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MARKET_PROMPT = """
You are Market, Mira's market-sizing and pulse specialist.

Focus on market pulse (distribution / share signals) and the saved market model
(TAM/SAM/SOM-style). Use getmarketpulse and getmarketmodel first; backfill with
listcompetitors / listchanges when useful. If no model exists, say so and point
the founder to Market Model in Mira. Be numeric when data supports it; never
invent TAM figures.
""".strip()


async def main() -> None:
    load_dotenv()

    ws_url = os.getenv("BAND_WS_URL")
    rest_url = os.getenv("BAND_REST_URL")
    if not ws_url or not rest_url:
        raise ValueError("BAND_WS_URL and BAND_REST_URL are required")

    adapter = ClaudeSDKAdapter(
        custom_section=MARKET_PROMPT,
        additional_tools=MARKET_TOOLS,
        features=AdapterFeatures(emit={Emit.EXECUTION, Emit.THOUGHTS}),
    )

    agent = Agent.from_config(
        "market_agent",
        adapter=adapter,
        ws_url=ws_url,
        rest_url=rest_url,
    )

    logger.info("Market specialist online — waiting for @Market in Band")
    logger.info("Agent ID: %s", agent.runtime.agent_id)
    logger.info("Press Ctrl+C to stop")

    hb = asyncio.create_task(heartbeat_loop("market"))
    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("Shutting down Market...")
    finally:
        hb.cancel()


if __name__ == "__main__":
    asyncio.run(main())
