#!/usr/bin/env bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/codex-traffic-light-notify.log"
ORIGINAL_NOTIFY="/Users/shan/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"

printf '%s codex_notify args=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
"$BASE_DIR/scripts/send_traffic_light.sh" DONE >> "$LOG_FILE" 2>&1 || true

if [ -x "$ORIGINAL_NOTIFY" ] && [ "$#" -ge 2 ]; then
  "$ORIGINAL_NOTIFY" "$@" >> "$LOG_FILE" 2>&1 || true
fi

exit 0
