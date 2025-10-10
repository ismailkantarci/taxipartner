#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"
PRISMA_DB="$PROJECT_ROOT/prisma/identity/dev.db"
IDENTITY_DB="$PROJECT_ROOT/identity/dev.db"

sync_identity_db() {
  if [[ -f "$PRISMA_DB" ]]; then
    cp "$PRISMA_DB" "$IDENTITY_DB"
    echo "[info] identity/dev.db dosyası Prisma DB ile senkronlandı."
  else
    echo "[warn] $PRISMA_DB bulunamadı, senkron atlandı."
  fi
}

cd "$IDENTITY_DIR"

echo "[info] Prisma client oluşturuluyor..."
npx prisma generate --schema ../prisma/schema.prisma

run_sync=false

echo "[info] Seed çalıştırmak istiyor musun? (y/n)"
read -r answer
answer=$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')
if [[ "$answer" == "y" ]]; then
  cd "$PROJECT_ROOT"
  npm run db:seed
  run_sync=true
else
  echo "[skip] Seed atlandı."
fi

cd "$IDENTITY_DIR"

echo "[info] Yeni migration var mı? (y/n)"
read -r migrate
migrate=$(printf '%s' "$migrate" | tr '[:upper:]' '[:lower:]')
if [[ "$migrate" == "y" ]]; then
  cd "$PROJECT_ROOT"
  npm run db:ensure
  run_sync=true
else
  echo "[skip] Migration atlandı."
fi

cd "$IDENTITY_DIR"

if [[ "$run_sync" == true ]] || { [[ ! -f "$IDENTITY_DB" ]] && [[ -f "$PRISMA_DB" ]]; }; then
  sync_identity_db
fi

echo "[ok] Prisma hazırlığı tamamlandı."
