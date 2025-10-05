#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"

cd "$IDENTITY_DIR"

echo "[info] Prisma client oluşturuluyor..."
npx prisma generate --schema ../prisma/schema.prisma

echo "[info] Seed çalıştırmak istiyor musun? (y/n)"
read -r answer
if [[ ${answer,,} == "y" ]]; then
  cd "$PROJECT_ROOT"
  npm run db:seed
else
  echo "[skip] Seed atlandı."
fi

echo "[info] Yeni migration var mı? (y/n)"
read -r migrate
if [[ ${migrate,,} == "y" ]]; then
  cd "$PROJECT_ROOT"
  npm run db:ensure
else
  echo "[skip] Migration atlandı."
fi

echo "[ok] Prisma hazırlığı tamamlandı."
