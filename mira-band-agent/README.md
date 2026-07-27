# Mira Band agents (local test)

Multi-agent room for Mira: specialists share a Band chat and pull live data
from your local Competitor Intelligence API.

| Agent | Role | Process |
|-------|------|---------|
| **Mira** | Orchestrator / analyst | `mira_agent.py` |
| **Pricing** | Tiers, $/mo, value | `pricing_agent.py` |
| **Watch** | Recent changes / alerts | `watch_agent.py` |
| **Positioning** | Landscape, gaps, battlecards | `positioning_agent.py` |
| **Market** | Market pulse + TAM model | `market_agent.py` |

## Prereqs

- Local Mira API on `:4000` (`npm run dev:server`)
- Local Mira web on `:5001` (optional)
- Node 20+ and `npm i -g @anthropic-ai/claude-code`
- `uv` installed
- Band.ai account — create **one agent per row above** with those display names

## Credentials

1. In Band, create agents named exactly: `Mira`, `Pricing`, `Watch`, `Positioning`, `Market`
2. Copy `agent_config.example.yaml` → `agent_config.yaml`
3. Paste each agent's `agent_id` + `api_key`
4. Copy `.env.example` → `.env` and set `MIRA_WORKSPACE_ID` if needed

`agent_config.yaml` is gitignored — do not commit keys.

## Run

```bash
cd mira-band-agent
uv sync

# Start all five Band agents at once
./start-all.sh

# Stop
./stop-all.sh
```

Or run individually (`uv run python mira_agent.py`, etc.). Logs: `logs/*.log`.

## Try in Band

1. Add **Mira** (and any specialists) to Participants
2. `@Mira what changed with my competitors this week?` → Mira should invite **Watch**
3. `@Mira where am I exposed on positioning?` → invite **Positioning**
4. `@Pricing compare entry prices` or let Mira pull Pricing in
5. `@Market summarize our market model`

Agents only know workspace data via Mira API tools (`MIRA_API_BASE`, token, workspace id).

While a Band process is running it heartbeats to `POST /api/analyst/agents/heartbeat`.
The Ask Mira page (`/analyst`) shows each agent with Online / Offline status
(in-app Mira + Pricing are online when the XAI key is set; Watch / Positioning /
Market turn green when their Band process is up).
