#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"

echo "[info] Admin paneli (Vite 5173) başlatılıyor..."
npm run dev
