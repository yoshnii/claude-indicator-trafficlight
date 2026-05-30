#!/usr/bin/env bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${CODEX_TRAFFIC_LIGHT_WRAPPER_LOG:-/tmp/codex-traffic-light-wrapper.log}"
CODEX_COMMAND="${CODEX_BIN:-codex}"
HOOK_TRUST_FLAG="--dangerously-bypass-hook-trust"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

send_light() {
  "$BASE_DIR/scripts/send_traffic_light.sh" "$1" >> "$LOG_FILE" 2>&1 || true
}

has_hook_trust_flag() {
  for arg in "$@"; do
    if [ "$arg" = "$HOOK_TRUST_FLAG" ]; then
      return 0
    fi
  done
  return 1
}

finish() {
  status=$?
  trap - EXIT

  if [ "$status" -eq 0 ]; then
    send_light DONE
  else
    send_light NEED_INPUT
  fi

  log "exit status=$status"
  exit "$status"
}

trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! command -v "$CODEX_COMMAND" >/dev/null 2>&1; then
  log "missing codex command=$CODEX_COMMAND"
  printf 'Codex command not found: %s\n' "$CODEX_COMMAND" >&2
  printf 'Set CODEX_BIN=/path/to/codex if your Codex CLI is not on PATH.\n' >&2
  exit 127
fi

log "start command=$CODEX_COMMAND args=$*"
send_light WORKING

if [ "${CODEX_TRAFFIC_LIGHT_BYPASS_HOOK_TRUST:-1}" = "1" ] && ! has_hook_trust_flag "$@"; then
  "$CODEX_COMMAND" "$HOOK_TRUST_FLAG" "$@"
else
  "$CODEX_COMMAND" "$@"
fi
