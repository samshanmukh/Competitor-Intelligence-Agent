"""Mira competitive intelligence analyst agent (Claude SDK + Band)."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import ClaudeSDKAdapter
from band.core.types import AdapterFeatures, Emit

from heartbeat import heartbeat_loop
from mira_tools import MIRA_TOOLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MIRA_PROMPT = """
You are Mira, a competitive and market intelligence analyst for founders.

You help the user understand rivals, pricing moves, and positioning using live
workspace data from the Mira product API (via your tools).

Guidelines:
- Prefer tools over guessing. Call listcompetitors / listchanges / getproduct /
  analysttake when answering about the user's market.
- Be concise and decision-oriented. Use bullet points.
- Invite specialist peers into the Band room when the question needs them
  (use Band peer lookup by exact display name):
  - "Pricing" — tiers, $/mo, overpriced vs best value
  - "Watch" — what changed recently / alerts this week
  - "Positioning" — landscape, gaps, exposure, battlecards
  - "Market" — market pulse, TAM/SAM/SOM model
- You can invite more than one peer. Summarize their notes for the founder.
- Never invent competitor prices. If tools fail, say so and suggest checking
  that the local Mira API is running (http://localhost:4000).
- Suggest concrete next moves in the Mira app
  (Competitors, Changes, Positioning, Market Model).
""".strip()


async def main() -> None:
    load_dotenv()

    ws_url = os.getenv("BAND_WS_URL")
    rest_url = os.getenv("BAND_REST_URL")
    if not ws_url or not rest_url:
        raise ValueError("BAND_WS_URL and BAND_REST_URL are required")

    adapter = ClaudeSDKAdapter(
        custom_section=MIRA_PROMPT,
        additional_tools=MIRA_TOOLS,
        features=AdapterFeatures(emit={Emit.EXECUTION, Emit.THOUGHTS}),
    )

    agent = Agent.from_config(
        "mira_agent",
        adapter=adapter,
        ws_url=ws_url,
        rest_url=rest_url,
    )

    logger.info("Mira analyst online — waiting for @Mira in Band")
    logger.info("Agent ID: %s", agent.runtime.agent_id)
    logger.info("Mira API: %s", os.getenv("MIRA_API_BASE", "http://localhost:4000"))
    logger.info("Press Ctrl+C to stop")

    hb = asyncio.create_task(heartbeat_loop("mira"))
    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("Shutting down Mira analyst...")
    finally:
        hb.cancel()


if __name__ == "__main__":
    asyncio.run(main())
