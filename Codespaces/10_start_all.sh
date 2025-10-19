#!/bin/bash
set -euo pipefail

bash "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/scripts/bootstrap_env.sh"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY_DIR="$PROJECT_ROOT/identity"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ADMIN_VITE_DIR="$PROJECT_ROOT/taxipartner-admin"
ENV_FILE="$IDENTITY_DIR/.env"
PORTS_TO_MANAGE=(3000 5173 5174 5179)

cd "$PROJECT_ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "[error] npm komutu bulunamadı. Node.js kurulumunu kontrol et."
  exit 1
fi

REQUIRED_ENV_KEYS=(JWT_SECRET DEV_CORS_ORIGINS DEV_BYPASS_AUTH DEV_BYPASS_EMAIL)
missing_env=()
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[error] identity/.env dosyası bulunamadı. `bash Codespaces/01_bootstrap.sh` veya env dosyasını manuel oluşturman gerekiyor."
  exit 1
fi
for key in "${REQUIRED_ENV_KEYS[@]}"; do
  value="$(grep -E "^$key=" "$ENV_FILE" | tail -n 1 | cut -d'=' -f2-)"
  value="${value//\"/}"
  value="${value//[[:space:]]/}"
  if [[ -z "$value" ]]; then
    missing_env+=("$key")
  fi
done
if (( ${#missing_env[@]} )); then
  echo "[error] identity/.env içinde şu kritik değerler boş: ${missing_env[*]}"
  echo "        Dosyayı güncellemeden servisler başlatılmayacak."
  exit 1
fi

ensure_node_modules() {
  local dir="$1"
  local label="$2"

  if [[ ! -f "$dir/package.json" ]]; then
    return
  fi

  if [[ -d "$dir/node_modules" ]] && compgen -G "$dir/node_modules/*" >/dev/null 2>&1; then
    echo "[check] node_modules ($label) mevcut."
    return
  fi

  echo "[info] node_modules ($label) eksik; npm install tetikleniyor..."
  npm --prefix "$dir" install
}

if [[ "${SKIP_AUTO_INSTALL:-0}" == "1" ]]; then
  echo "[info] SKIP_AUTO_INSTALL=1 ayarlandı; node_modules kontrolü atlandı."
else
  ensure_node_modules "$PROJECT_ROOT" "root"
  ensure_node_modules "$IDENTITY_DIR" "identity"
  ensure_node_modules "$FRONTEND_DIR" "frontend"
  ensure_node_modules "$ADMIN_VITE_DIR" "taxipartner-admin"
fi

if [[ "${SKIP_PRISMA_DEPLOY:-0}" == "1" ]]; then
  echo "[info] SKIP_PRISMA_DEPLOY=1 ayarlandı; prisma migrate deploy adımı atlandı."
else
  echo "[info] Prisma migrate deploy çalıştırılıyor..."
  if npx prisma migrate deploy --schema prisma/schema.prisma; then
    echo "[info] Prisma migrate deploy tamamlandı."
  else
    echo "[error] Prisma migrate deploy başarısız oldu; log çıktısını incele."
    exit 1
  fi
fi

ensure_codespace_scope() {
  if [[ "${CODESPACES:-false}" != "true" ]]; then
    return
  fi
  if ! command -v gh >/dev/null 2>&1; then
    return
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "[warn] gh CLI için etkin bir oturum yok; \`gh auth login --web\` ile giriş yapabilirsin."
    return
  fi

  local scopes_line scopes_normalized
  scopes_line="$(gh auth status 2>/dev/null | sed -n 's/.*Token scopes: //p')"
  scopes_normalized="$(echo "$scopes_line" | tr -d \" | tr '[:upper:]' '[:lower:]')"
  if [[ "$scopes_normalized" != *codespace* ]]; then
    echo "[info] gh auth refresh -s codespace calistiriliyor (tek seferlik cihaz dogrulamasi gerekebilir)..."
    local restore_github_token="${GITHUB_TOKEN:-}"
    local restore_gh_token="${GH_TOKEN:-}"
    unset GITHUB_TOKEN
    unset GH_TOKEN
    if gh auth refresh -h github.com -s codespace; then
      echo "[info] gh codespace scope eklendi."
    else
      echo "[warn] codespace scope eklenemedi; gerekirse \`gh auth refresh -h github.com -s codespace\` komutunu manuel calistir."
    fi
    if [[ -n "$restore_github_token" ]]; then
      export GITHUB_TOKEN="$restore_github_token"
    fi
    if [[ -n "$restore_gh_token" ]]; then
      export GH_TOKEN="$restore_gh_token"
    elif [[ -z "$restore_gh_token" && -n "$restore_github_token" ]]; then
      export GH_TOKEN="$restore_github_token"
    fi
  fi
}

ensure_codespace_scope

free_occupied_ports() {
  if ! command -v lsof >/dev/null 2>&1; then
    echo "[warn] lsof bulunamadı; port temizliği atlanıyor."
    return
  fi

  local port
  for port in "${PORTS_TO_MANAGE[@]}"; do
    local -a listeners=()
    local -a still_listening=()

    mapfile -t listeners < <(lsof -t -i "tcp:${port}" -s tcp:listen 2>/dev/null | sort -u)
    if (( ${#listeners[@]} == 0 )); then
      continue
    fi

    echo "[warn] Port ${port} şu süreçler tarafından kullanılıyor: ${listeners[*]} -- SIGTERM gönderiliyor."
    if ! kill "${listeners[@]}" 2>/dev/null; then
      echo "[warn] Port ${port} için SIGTERM başarısız olabilir; izlemeye devam ediliyor."
    fi
    sleep 1

    mapfile -t still_listening < <(lsof -t -i "tcp:${port}" -s tcp:listen 2>/dev/null | sort -u)
    if (( ${#still_listening[@]} == 0 )); then
      echo "[info] Port ${port} serbest bırakıldı."
      continue
    fi

    echo "[warn] Port ${port} hala meşgul (${still_listening[*]}); SIGKILL gönderiliyor."
    kill -9 "${still_listening[@]}" 2>/dev/null || true
    sleep 1

    if lsof -t -i "tcp:${port}" -s tcp:listen >/dev/null 2>&1; then
      echo "[error] Port ${port} SIGKILL sonrasında da meşgul görünüyor; manuel müdahale gerekebilir."
    else
      echo "[info] Port ${port} zorla serbest bırakıldı."
    fi
  done
}

if command -v gh >/dev/null 2>&1; then
  CACHE_DIR="$HOME/.cache"
  REFRESH_MARKER="$CACHE_DIR/gh-last-refresh"
  mkdir -p "$CACHE_DIR"

  if [ -n "${GITHUB_TOKEN:-}" ] || [ -n "${GH_TOKEN:-}" ]; then
    echo "[info] GITHUB_TOKEN ortam değişkeni kullanılıyor; gh auth refresh adımı atlandı."
  elif [ ! -f "$REFRESH_MARKER" ] || find "$REFRESH_MARKER" -mmin +720 >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
      echo "[info] gh auth refresh çalıştırılıyor..."
      if gh auth refresh --hostname github.com >/dev/null 2>&1; then
        touch "$REFRESH_MARKER"
        echo "[info] gh auth refresh tamamlandı."
      else
        echo "[warn] gh auth refresh başarısız oldu; Codespaces servisleri yine de başlatılıyor."
      fi
    else
      echo "[warn] gh CLI için etkin bir oturum yok; `gh auth login --web` ile giriş yapabilirsin."
    fi
  fi
fi

free_occupied_ports

echo "[info] Codespaces servisleri (identity, admin, identity-spa, taxipartner-admin) paralel başlatılıyor..."
echo "[info] Çıktılar aynı terminalde akacak; gerekirse yeni bir terminal sekmesinden komutları ayrı ayrı çalıştırabilirsin."

if command -v gh >/dev/null 2>&1 && [[ "${AUTO_REBUILD_DEVCONTAINER:-0}" == "1" ]] && [[ -n "${CODESPACE_NAME:-}" ]]; then
  echo "[info] AUTO_REBUILD_DEVCONTAINER=1 ayarlandı; mevcut Codespace yeniden oluşturulacak."
  if gh codespace rebuild --codespace "$CODESPACE_NAME"; then
    echo "[info] Codespace yeniden oluşturma tetiklendi; işlem tamamlandıktan sonra ortam kapanabilir."
    exit 0
  else
    echo "[warn] Codespace yeniden oluşturma başarısız oldu; gerekirse komutu manuel çalıştır."
  fi
fi

if command -v gh >/dev/null 2>&1 && [[ -n "${CODESPACE_NAME:-}" ]]; then
  PORTS_TO_PUBLIC=("${PORTS_TO_MANAGE[@]}")
  ports_csv="$(IFS=','; echo "${PORTS_TO_PUBLIC[*]}")"
  visibility_args=()
  for port in "${PORTS_TO_PUBLIC[@]}"; do
    visibility_args+=("${port}:public")
  done
  if gh auth status >/dev/null 2>&1; then
    echo "[info] Codespaces port görünürlüğü public olarak ayarlanacak: ${ports_csv}"
    (
      set +e
      sleep 8
      for attempt in {1..5}; do
        if gh codespace ports visibility "${visibility_args[@]}" --codespace "$CODESPACE_NAME" >/dev/null 2>&1; then
          echo "[info] Port görünürlüğü public yapıldı."
          exit 0
        fi
        sleep 5
      done
      echo "[warn] Port görünürlüğü public yapılamadı; VS Code Port sekmesinden manuel kontrol et."
    ) &
  else
    echo "[warn] gh CLI oturumu yok; port görünürlüğü otomatik değiştirilemedi."
  fi
fi

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  FORWARD_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  echo "[info] Hızlı erişim URL'leri:"
  echo "       - Identity SPA login: https://${CODESPACE_NAME}-5174.${FORWARD_DOMAIN}/#/auth/login"
  echo "       - Admin sandbox:      https://${CODESPACE_NAME}-5179.${FORWARD_DOMAIN}/"
fi

npm run codespaces:start
