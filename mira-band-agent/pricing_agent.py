"""Mira pricing specialist agent (Claude SDK + Band)."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import ClaudeSDKAdapter
from band.core.types import AdapterFeatures, Emit

from heartbeat import heartbeat_loop
from mira_tools import PRICING_TOOLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PRICING_PROMPT = """
You are Pricing, a specialist agent for Mira.

Focus on entry prices, plan tiers, and recent pricing-related changes among
tracked competitors. Use listcompetitors and listchanges tools. Be numeric and
specific. Flag who looks overpriced vs best value when data allows.
If Mira invited you, answer the pricing question and keep replies short.
""".strip()


async def main() -> None:
    load_dotenv()

    ws_url = os.getenv("BAND_WS_URL")
    rest_url = os.getenv("BAND_REST_URL")
    if not ws_url or not rest_url:
        raise ValueError("BAND_WS_URL and BAND_REST_URL are required")

    adapter = ClaudeSDKAdapter(
        custom_section=PRICING_PROMPT,
        additional_tools=PRICING_TOOLS,
        features=AdapterFeatures(emit={Emit.EXECUTION, Emit.THOUGHTS}),
    )

    agent = Agent.from_config(
        "pricing_agent",
        adapter=adapter,
        ws_url=ws_url,
        rest_url=rest_url,
    )

    logger.info("Pricing specialist online")
    logger.info("Agent ID: %s", agent.runtime.agent_id)
    logger.info("Press Ctrl+C to stop")

    hb = asyncio.create_task(heartbeat_loop("pricing"))
    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("Shutting down Pricing...")
    finally:
        hb.cancel()


if __name__ == "__main__":
    asyncio.run(main())
