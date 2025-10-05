#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"

cd "$IDENTITY_DIR"

echo "[info] Identity backend başlatılıyor..."
npm run dev
