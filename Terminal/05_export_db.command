#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$PROJECT_ROOT/prisma/identity/dev.db"
DEFAULT_SHELL="${SHELL:-/bin/zsh}"

cd "$PROJECT_ROOT"

export DATABASE_URL="file:${DB_PATH}"

cat <<MSG
[env] DATABASE_URL ayarlandı:
${DATABASE_URL}

Artık bu pencere üzerinden `npm run db:ensure`, `npm run db:reset`, `npm run seed:mp18` gibi komutları çalıştırabilirsin.
Bu pencere açık kalacak, komutları doğrudan yazabilirsin.
MSG

echo "[info] Ortam değişkeni kalıcı olsun diye yeni bir kabuk açılıyor..."
exec env DATABASE_URL="$DATABASE_URL" "$DEFAULT_SHELL"
