#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"
ENV_FILE="$IDENTITY_DIR/.env"

cd "$PROJECT_ROOT"

echo "[check] Proje dizini: $PROJECT_ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo "[error] Node.js yüklü değil. https://nodejs.org/ adresinden 20.x sürümünü kur."
  exit 1
fi

NODE_VERSION="$(node -v)"
echo "[check] Node sürümü: $NODE_VERSION"
if [[ $NODE_VERSION != v20* ]]; then
  echo "[warn] Node 20.x kullanman önerilir."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[error] $ENV_FILE bulunamadı. Kimlik servisi için .env dosyasını oluştur."
  exit 1
fi

missing_keys=()
for key in JWT_SECRET DEV_CORS_ORIGINS DEV_BYPASS_AUTH DEV_BYPASS_EMAIL; do
  value="$(grep -E "^$key=" "$ENV_FILE" | sed "s/^$key=//")"
  if [[ -z "$value" ]]; then
    missing_keys+=("$key")
  fi
done

if (( ${#missing_keys[@]} )); then
  echo "[warn] Aşağıdaki .env değerleri boş: ${missing_keys[*]}"
  echo "       $ENV_FILE dosyasını güncelle."
else
  echo "[check] .env içindeki kritik değerler dolu görünüyor."
fi

echo "[ok] Kontrol tamamlandı."
