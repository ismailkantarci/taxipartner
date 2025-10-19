#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"

cd "$IDENTITY_DIR"

echo "[info] Prisma client oluşturuluyor..."
npx prisma generate --schema ../prisma/schema.prisma

echo "[info] Seed çalıştırmak istiyor musun? (y/n)"
read -r answer
case "$answer" in
  [Yy])
    cd "$PROJECT_ROOT"
    npm run db:seed
    ;;
  *)
    echo "[skip] Seed atlandı."
    ;;
esac

echo "[info] Yeni migration var mı? (y/n)"
read -r migrate
case "$migrate" in
  [Yy])
    cd "$PROJECT_ROOT"
    npm run db:ensure
    ;;
  *)
    echo "[skip] Migration atlandı."
    ;;
esac

echo "[ok] Prisma hazırlığı tamamlandı."
