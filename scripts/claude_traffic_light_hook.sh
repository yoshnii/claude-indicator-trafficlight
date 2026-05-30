#!/usr/bin/env bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMAND="${1:-DONE}"
LOG_FILE="/tmp/claude-traffic-light-hook.log"

printf '%s command=%s port=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$COMMAND" "${TRAFFIC_LIGHT_PORT:-auto}" >> "$LOG_FILE"
"$BASE_DIR/scripts/send_traffic_light.sh" "$COMMAND" >> "$LOG_FILE" 2>&1 || true
exit 0
