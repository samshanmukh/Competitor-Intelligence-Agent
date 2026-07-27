#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

agents=(mira_agent pricing_agent watch_agent positioning_agent market_agent)
for name in "${agents[@]}"; do
  if [[ -f "logs/${name}.pid" ]]; then
    pid=$(cat "logs/${name}.pid")
    kill "$pid" 2>/dev/null || true
    rm -f "logs/${name}.pid"
  fi
  pkill -f "uv run python ${name}.py" 2>/dev/null || true
done
echo "Stopped Band agents."
