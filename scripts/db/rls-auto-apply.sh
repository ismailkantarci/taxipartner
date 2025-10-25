#!/usr/bin/env bash
set -euo pipefail

if [[ "${RLS_AUTO_APPLY:-}" == "true" ]]; then
  echo "[rls-auto] applying RLS ensure --apply"
  npm run -s db:rls:ensure -- --apply || true
else
  echo "[rls-auto] RLS_AUTO_APPLY!=true; skipping"
fi
