#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PORT=5174

if ! command -v lsof >/dev/null 2>&1; then
  echo "[error] lsof bulunamadı. macOS'ta 'xcode-select --install' çalıştırman gerekebilir."
  exit 1
fi

ensure_port_free() {
  local port="$1"
  local label="$2"
  local pids
  if ! pids=$(lsof -ti ":${port}" 2>/dev/null); then
    return
  fi
  echo "[warn] ${label} portu (${port}) kullanımda. Eski süreçler sonlandırılıyor..."
  echo "[warn] PID(ler): ${pids}"
  if ! kill ${pids} 2>/dev/null; then
    echo "[warn] SIGTERM başarısız, yok sayılıyor."
  fi
  sleep 1
  if lsof -ti ":${port}" >/dev/null 2>&1; then
    echo "[warn] Port ${port} hala dolu, SIGKILL uygulanıyor..."
    kill -9 ${pids} 2>/dev/null || true
    sleep 1
  fi
  if lsof -ti ":${port}" >/dev/null 2>&1; then
    echo "[error] Port ${port} hala meşgul. Lütfen bu portu kullanan süreci manuel kapat."
    exit 1
  fi
}

cd "$FRONTEND_DIR"

ensure_port_free "$PORT" "Identity SPA"

echo "[info] Identity SPA (5174) başlatılıyor..."
exec npm run dev
