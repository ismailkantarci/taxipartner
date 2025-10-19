#!/usr/bin/env sh
set -eu
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

load_env_file() {
  FILE="$1"
  [ -f "$FILE" ] || return 0
  # KEY=VAL satırlarını al; yorumları/boşları at
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=.*' "$FILE" | sed -E 's/\r$//' | while IFS='=' read -r k v; do
    v="${v#\"}"; v="${v%\"}"
    v="${v#\'}"; v="${v%\'}"
    export "$k=$v"
  done
}

# 1) Root .env (OpenAI + genel)
[ -f "$ROOT_DIR/.env" ] || echo "[bootstrap_env] INFO: No .env at repo root; copy from .env.example"
load_env_file "$ROOT_DIR/.env"

# 2) identity/.env (zorunlu identity anahtarları)
ID_ENV="$ROOT_DIR/identity/.env"
if [ -f "$ID_ENV" ]; then
  load_env_file "$ID_ENV"
else
  echo "[bootstrap_env] WARN: identity/.env not found; identity may fail. Copy from identity/.env.example"
fi

# 3) OpenAI vars (defaults)
export OPENAI_MODEL="${OPENAI_MODEL:-gpt-5-pro}"
export OPENAI_CODEX_MODEL="${OPENAI_CODEX_MODEL:-gpt-5-codex}"

# 4) Codespaces ortamında mevcutsa GitHub token'ını çek
if [ "${CODESPACES:-false}" = "true" ]; then
  CODESPACES_ENV_FILE="/workspaces/.codespaces/shared/user-secrets-envs.json"
  if [ -z "${GITHUB_TOKEN:-}" ] && [ -f "$CODESPACES_ENV_FILE" ]; then
    CODESPACES_GH_TOKEN="$(
      python3 - <<'PY'
import json
from pathlib import Path
path = Path("/workspaces/.codespaces/shared/user-secrets-envs.json")
try:
    data = json.loads(path.read_text())
except FileNotFoundError:
    data = {}
token = data.get("GITHUB_TOKEN", "")
if token:
    print(token)
PY
    )"
    if [ -n "$CODESPACES_GH_TOKEN" ]; then
      export GITHUB_TOKEN="$CODESPACES_GH_TOKEN"
      echo "[bootstrap_env] INFO: GITHUB_TOKEN Codespaces ortamından yüklendi."
    fi
  fi
  if [ -z "${GH_TOKEN:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    export GH_TOKEN="$GITHUB_TOKEN"
  fi
fi

echo "[bootstrap_env] OPENAI_MODEL=$OPENAI_MODEL | OPENAI_CODEX_MODEL=$OPENAI_CODEX_MODEL"
