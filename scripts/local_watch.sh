#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PID_FILE="${ROOT_DIR}/.local_watch.pid"
LOG_FILE="${ROOT_DIR}/.local_watch.log"
INTERVAL="${INTERVAL:-5}"

# Optional: load user env (e.g., OPENAI_API_KEY, AI_SUMMARIZE=1, AI_LANGS=tr)
ENV_FILE="$HOME/.tp_admin.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

start() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[local-watch] already running (pid $(cat "$PID_FILE"))"; return 0; fi
  if ! command -v python3 >/dev/null 2>&1; then echo "python3 not found"; exit 1; fi
  nohup python3 "${ROOT_DIR}/scripts/local_watch_auto_release.py" --interval "$INTERVAL" \
    >"$LOG_FILE" 2>&1 & echo $! > "$PID_FILE"
  echo "[local-watch] started (pid $(cat "$PID_FILE")), interval=${INTERVAL}s"
}

stop() {
  if [[ -f "$PID_FILE" ]]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "[local-watch] stopped"
  else
    echo "[local-watch] not running"
  fi
}

status() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[local-watch] running (pid $(cat "$PID_FILE"))"
  else
    echo "[local-watch] not running"
  fi
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; start ;;
  *) echo "Usage: $0 {start|stop|status|restart}"; exit 1 ;;
esac
