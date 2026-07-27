#!/usr/bin/env bash
# Start all five Mira Band agents (each is a long-running process).
set -euo pipefail
cd "$(dirname "$0")"

export PATH="/usr/bin:/bin:/opt/homebrew/bin:$HOME/.hermes/node/bin:$HOME/.local/bin:$PATH"

mkdir -p logs
agents=(mira_agent pricing_agent watch_agent positioning_agent market_agent)

for name in "${agents[@]}"; do
  # Kill prior instance of this agent if still running from this folder
  pkill -f "uv run python ${name}.py" 2>/dev/null || true
done
sleep 1

for name in "${agents[@]}"; do
  echo "Starting ${name}..."
  nohup uv run python "${name}.py" >"logs/${name}.log" 2>&1 &
  echo $! >"logs/${name}.pid"
  echo "  pid=$(cat "logs/${name}.pid") log=logs/${name}.log"
done

echo
echo "All five agents launching. Tail logs with:"
echo "  tail -f logs/*.log"
echo "Stop with: ./stop-all.sh"
