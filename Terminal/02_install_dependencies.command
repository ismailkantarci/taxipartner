#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"

function install_if_needed() {
  local dir="$1"
  cd "$dir"
  echo "[info] npm install (${dir}) çalışıyor..."
  npm install
}

install_if_needed "$PROJECT_ROOT"
install_if_needed "$IDENTITY_DIR"

echo "[ok] Bağımlılıklar güncellendi."
