#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"

echo "[info] Tailwind watcher başlatılıyor..."
npx tailwindcss -i src/styles/tailwind.css -o dist/output.css --watch --postcss
