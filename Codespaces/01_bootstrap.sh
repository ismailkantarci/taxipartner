#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$IDENTITY_DIR/.env"

echo "[check] Proje dizini: $PROJECT_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "[error] Node.js yüklü değil. Codespaces devcontainer ayarlarını kontrol et."
  exit 1
fi

NODE_VERSION="$(node -v)"
echo "[check] Node sürümü: $NODE_VERSION"
if [[ $NODE_VERSION != v20* ]]; then
  echo "[warn] Node 20.x önerilir. Mevcut sürüm bazı yardımcı komutlar için sorun çıkarabilir."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[warn] $ENV_FILE eksik. Identity servisinin doğru çalışması için bu dosyayı oluşturmalısın."
  echo "       Kendi ortam değişkenlerini ekleyerek dosyayı manuel oluştur."
else
  missing_keys=()
  for key in JWT_SECRET DEV_CORS_ORIGINS DEV_BYPASS_AUTH DEV_BYPASS_EMAIL; do
    value="$(grep -E "^$key=" "$ENV_FILE" | sed "s/^$key=//")"
    if [[ -z "$value" ]]; then
      missing_keys+=("$key")
    fi
  done

  if (( ${#missing_keys[@]} )); then
    echo "[warn] identity/.env içindeki şu değerler boş: ${missing_keys[*]}"
  else
    echo "[check] identity/.env kritik değerleri dolu."
  fi
fi

install_if_needed() {
  local dir="$1"
  if [[ ! -f "$dir/package.json" ]]; then
    return
  fi

  echo "[info] npm install ($dir) çalışıyor..."
  npm --prefix "$dir" install
}

install_if_needed "$PROJECT_ROOT"
install_if_needed "$IDENTITY_DIR"
install_if_needed "$FRONTEND_DIR"

echo "[info] Prisma client oluşturuluyor..."
npx prisma generate --schema prisma/schema.prisma

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[info] docker compose ile Postgres kaldırılıyor..."
    docker compose up -d
  else
    echo "[warn] Docker daemon erişilemedi. Postgres'i manuel başlat."
  fi
else
  echo "[warn] Docker kurulu değil. Postgres için alternatif bir bağlantı kullanmalısın."
fi

echo "[ok] Codespaces bootstrap tamamlandı."
