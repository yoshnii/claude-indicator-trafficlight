#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-DONE}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -x "$BASE_DIR/scripts/traffic_light_send.py" ]; then
  "$BASE_DIR/scripts/traffic_light_send.py" "$COMMAND"
  exit 0
fi

if [ -z "${TRAFFIC_LIGHT_PORT:-}" ]; then
  echo "traffic_light_send.py is required for automatic port detection" >&2
  exit 1
fi

printf '%s\n' "$COMMAND" > "$TRAFFIC_LIGHT_PORT"
