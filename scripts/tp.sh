#!/usr/bin/env bash
set -euo pipefail

# ----- color helpers -----
CSI=$'\033['; RESET="${CSI}0m"; GRN="${CSI}32m"; CYN="${CSI}36m"; YEL="${CSI}33m"; RED="${CSI}31m"
log()  { printf '%s[tp]%s %s\n'  "$CYN" "$RESET" "$*"; }
ok()   { printf '%s[tp]%s %s\n'  "$GRN" "$RESET" "$*"; }
warn() { printf '%s[tp]%s %s\n'  "$YEL" "$RESET" "$*"; }
err()  { printf '%s[tp][error]%s %s\n' "$RED" "$RESET" "$*" >&2; }

# ----- paths & defaults -----
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || { echo "cannot resolve project dir" >&2; exit 1; }
cd "$PROJECT_DIR" || exit 1

ENV_FILE="$PROJECT_DIR/identity/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-taxipartner-postgres}"
DB_URL_DEFAULT="postgresql://taxipartner:postgres@localhost:5432/taxipartner_dev?schema=public"
APP_URL_DEFAULT="${APP_URL_DEFAULT:-postgresql://app_user:app_user_pw@localhost:5432/taxipartner_dev?schema=public}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
DEFAULT_PORT="${DEFAULT_PORT:-3001}"
ADMIN_PORT="${ADMIN_PORT:-5173}"
SPA_PORT="${SPA_PORT:-5174}"
ADMIN_SUITE_PORT="${ADMIN_SUITE_PORT:-5179}"
OPA_PORT="${OPA_PORT:-46000}"
POLICY_DEFAULT_PORT="${POLICY_SHIM_PORT:-3300}"

FORCE_CLEAN="${TP_FORCE_CLEAN:-0}"
QUIET_MODE="${TP_QUIET:-0}"
OUTPUT_JSON="${TP_JSON:-0}"
HEALTH_WAIT="${TP_HEALTH_TIMEOUT:-90}"
LOG_MAX_BYTES="${TP_LOG_MAX_BYTES:-0}"
ANALYZE_EVENTS="${TP_ANALYZE_EVENTS:-1}"
FORCE_THRESHOLD="${TP_FORCE_THRESHOLD:-3}"

LOG_DIR="${TP_LOG_DIR:-$PROJECT_DIR/.tp}"
STATE_FILE="${LOG_DIR}/restart.state"
EVENT_LOG="${LOG_DIR}/health.log"
MAX_RESTART="${TP_MAX_RESTART:-3}"
SMOKE_ENABLED="${TP_SMOKE_TEST:-0}"

mkdir -p "$LOG_DIR"

if [[ "$QUIET_MODE" == "1" && "$OUTPUT_JSON" != "1" ]]; then
  log()  { :; }
  ok()   { :; }
  warn() { :; }
fi

if ! [[ "$MAX_RESTART" =~ ^[0-9]+$ ]] || (( MAX_RESTART < 1 )); then
  MAX_RESTART=1
fi

if ! [[ "$HEALTH_WAIT" =~ ^[0-9]+$ ]] || (( HEALTH_WAIT < 1 )); then
  HEALTH_WAIT=90
fi

if ! [[ "$FORCE_THRESHOLD" =~ ^[0-9]+$ ]] || (( FORCE_THRESHOLD < 1 )); then
  FORCE_THRESHOLD=3
fi

declare -A RESTART_STATE=()

truncate_file() {
  local file="$1"
  if (( LOG_MAX_BYTES > 0 )) && [[ -f "$file" ]]; then
    local size
    size=$(wc -c <"$file" 2>/dev/null || echo 0)
    if (( size > LOG_MAX_BYTES )); then
      local tmp="${file}.tmp"
      tail -c "$LOG_MAX_BYTES" "$file" >"$tmp" 2>/dev/null && mv "$tmp" "$file"
    fi
  fi
}

append_event() {
  local message="$1"
  printf '%s %s\n' "$(date +'%Y-%m-%dT%H:%M:%S')" "$message" >>"$EVENT_LOG"
  truncate_file "$EVENT_LOG"
}

load_restart_state() {
  RESTART_STATE=()
  if [[ -f "$STATE_FILE" ]]; then
    while IFS='=' read -r key value; do
      [[ -z "${key:-}" ]] && continue
      RESTART_STATE["$key"]="${value:-0}"
    done <"$STATE_FILE"
  fi
}

analyze_recent_events() {
  (( ANALYZE_EVENTS != 1 )) && return 0
  if [[ ! -f "$EVENT_LOG" ]]; then
    return 0
  fi
  local recent
  recent="$(tail -n 50 "$EVENT_LOG" 2>/dev/null || true)"
  [[ -z "$recent" ]] && return 0

  local admin_fails=0 spa_fails=0 suite_fails=0 identity_fails=0 force_count=0
  set +e
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    if grep -q 'smoke.fail Admin UI' <<<"$line"; then ((admin_fails++)); fi
    if grep -q 'smoke.fail Identity SPA' <<<"$line"; then ((spa_fails++)); fi
    if grep -q 'smoke.fail Admin Suite' <<<"$line"; then ((suite_fails++)); fi
    if grep -q 'smoke.fail Identity API' <<<"$line"; then ((identity_fails++)); fi
    if grep -q '^force_clean ' <<<"$line"; then ((force_count++)); fi
  done <<<"$recent"
  set -e

  if [[ "$OUTPUT_JSON" == "1" ]]; then
    printf '{"analysis":{"adminFails":%d,"spaFails":%d,"suiteFails":%d,"identityFails":%d,"forceClean":%d}}\n' \
      "$admin_fails" "$spa_fails" "$suite_fails" "$identity_fails" "$force_count"
  elif [[ "$QUIET_MODE" != "1" ]]; then
    local analysis_line
    printf -v analysis_line 'Son olay analizi → admin_fail=%d spa_fail=%d suite_fail=%d identity_fail=%d force_clean=%d' \
      "$admin_fails" "$spa_fails" "$suite_fails" "$identity_fails" "$force_count"
    log "$analysis_line"
  fi

  if (( admin_fails >= FORCE_THRESHOLD )); then
    warn "Admin UI son kayıtlar içinde %d kez başarısız görünüyordu; force clean tetiklenecek." "$admin_fails"
    FORCE_CLEAN=1
  fi
  if (( spa_fails >= FORCE_THRESHOLD )); then
    warn "Identity SPA son kayıtlar içinde %d kez başarısız görünüyordu; force clean tetiklenecek." "$spa_fails"
    FORCE_CLEAN=1
  fi
  if (( suite_fails >= FORCE_THRESHOLD )); then
    warn "Admin Suite son kayıtlar içinde %d kez başarısız görünüyordu; force clean tetiklenecek." "$suite_fails"
    FORCE_CLEAN=1
  fi
  if (( identity_fails >= FORCE_THRESHOLD )); then
    warn "Identity API son kayıtlar içinde %d kez başarısız görünüyordu; force clean tetiklenecek." "$identity_fails"
    FORCE_CLEAN=1
  fi
}

save_restart_state() {
  local tmp="${STATE_FILE}.tmp"
  : >"$tmp"
  for key in "${!RESTART_STATE[@]}"; do
    printf '%s=%s\n' "$key" "${RESTART_STATE[$key]}" >>"$tmp"
  done
  mv "$tmp" "$STATE_FILE"
}

increment_restart() {
  local key="$1"
  local current="${RESTART_STATE[$key]:-0}"
  current=$((current + 1))
  RESTART_STATE["$key"]="$current"
  save_restart_state
  append_event "restart.increment ${key}=${current}"
  if (( current == MAX_RESTART )); then
    warn "$key için otomatik yeniden başlatmada son deneme (${current}/${MAX_RESTART})."
  fi
  if (( current > MAX_RESTART )); then
    warn "$key için maksimum otomatik yeniden başlatma denendi (${MAX_RESTART}). Manuel müdahale önerilir."
    return 1
  fi
  return 0
}

reset_restart() {
  local key="$1"
  if [[ "${RESTART_STATE[$key]:-0}" != "0" ]]; then
    RESTART_STATE["$key"]=0
    save_restart_state
    append_event "restart.reset ${key}"
  fi
}

# ----- helpers -----
resolve_port() {
  local p="${PORT:-}"
  if [[ -z "$p" && -f "$ENV_FILE" ]]; then
    p="$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  fi
  if [[ -z "$p" ]]; then
    p="$DEFAULT_PORT"
  fi
  printf '%s' "$p"
}

health_url() {
  local p; p="$(resolve_port)"
  printf 'http://127.0.0.1:%s%s' "$p" "$HEALTH_PATH"
}

ensure_env() {
  mkdir -p "$(dirname "$ENV_FILE")"
  [[ -f "$ENV_FILE" ]] || : >"$ENV_FILE"

  declare -A DEF=(
    [JWT_ACCESS_SECRET]='dev_access_secret_please_change'
    [JWT_REFRESH_SECRET]='dev_refresh_secret_please_change'
    [JWT_ISS]='taxipartner-dev'
    [JWT_AUD]='taxipartner-admin'
    [JWT_ACCESS_TTL]='15m'
    [JWT_REFRESH_TTL]='30d'
    [PORT]="$DEFAULT_PORT"
  )

  local added=false
  for k in "${!DEF[@]}"; do
    if ! grep -q "^${k}=" "$ENV_FILE" 2>/dev/null; then
      printf '%s=%s\n' "$k" "${DEF[$k]}" >> "$ENV_FILE"
      added=true
    fi
  done

  if grep -q '^JWT_ISSUER=' "$ENV_FILE" 2>/dev/null; then
    sed -i '/^JWT_ISSUER=/d' "$ENV_FILE" || true
    warn "identity/.env içindeki eski JWT_ISSUER anahtarı temizlendi."
  fi

  $added && ok "identity/.env varsayılanları tamamlandı." || log "identity/.env mevcut."
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "( sport = :$port )" 2>/dev/null | grep -q ":$port" && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -Pn >/dev/null 2>&1 && return 0
  fi
  return 1
}

kill_on_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port"/tcp 2>/dev/null || true)"
  fi
  if [[ -n "${pids:-}" ]]; then
    warn "Port $port üzerindeki süreçler sonlandırılıyor → $pids"
    xargs -r kill <<<"$pids" || true
  fi
}

wait_http() {
  local url="$1"
  local max="${2:-60}"
  for _ in $(seq 1 "$max"); do
    if command -v curl >/dev/null 2>&1; then
      curl -fsS --max-time 2 "$url" >/dev/null 2>&1 && return 0
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O /dev/null "$url" && return 0
    else
      warn "curl/wget yok; health kontrolü atlandı."
      return 0
    fi
    sleep 1
  done
  return 1
}

probe_http() {
  local url="$1"
  local timeout="${2:-2}"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time "$timeout" "$url" >/dev/null 2>&1
    return $?
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q -T "$timeout" -O /dev/null "$url"
    return $?
  fi
  return 2
}

port_process_info() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local line
  line="$(lsof -iTCP:"$port" -sTCP:LISTEN -Pn -F pc 2>/dev/null | paste -sd' ' -)"
  if [[ -n "${line:-}" ]]; then
    local pid cmd
    pid="$(sed -n 's/^p//p' <<<"$line" | head -n1)"
    cmd="$(sed -n 's/^c//p' <<<"$line" | head -n1)"
    if [[ -n "${pid:-}" && -n "${cmd:-}" ]]; then
      printf ' (pid %s: %s)' "$pid" "$cmd"
    fi
  fi
}

tail_log_snippet() {
  local file="$1" label="$2"
  if [[ -f "$file" ]]; then
    truncate_file "$file"
    log "$label log son 10 satır:"
    tail -n 10 "$file" || true
  fi
}

force_clean_ports() {
  local main_port extra_port
  main_port="$(resolve_port)"
  if [[ "$main_port" =~ ^[0-9]+$ ]]; then
    extra_port=$((main_port + 1))
  else
    extra_port=""
  fi
  local kill_ports=()
  kill_ports+=("$main_port" "$extra_port" "$ADMIN_PORT" "$SPA_PORT" "$ADMIN_SUITE_PORT")
  if [[ -n "${TP_CLEAN_PORTS:-}" ]]; then
    for extra in ${TP_CLEAN_PORTS}; do
      kill_ports+=("$extra")
    done
  fi
  local unique=()
  declare -A seen=()
  for port in "${kill_ports[@]}"; do
    [[ -z "${port:-}" ]] && continue
    if [[ -z "${seen[$port]:-}" ]]; then
      seen[$port]=1
      unique+=("$port")
    fi
  done
  for port in "${unique[@]}"; do
    if port_in_use "$port"; then
      warn "Force clean → port $port kapatılıyor$(port_process_info "$port")"
    else
      log "Force clean → port $port zaten boş"
    fi
    kill_on_port "$port"
  done
  append_event "force_clean ports=${unique[*]}"
}

format_summary() {
  local label="$1" status="${2:-0}" restarted="${3:-0}"
  local icon extras=()
  case "$status" in
    0) icon="✅" ;;
    1) icon="♻️" ;;
    2) icon="🚨" ;;
    *) icon="❔" ;;
  esac
  if (( restarted )); then
    extras+=("restartlandı")
  fi
  if (( status == 2 )); then
    extras+=("limit")
  fi
  local suffix=""
  if (( ${#extras[@]} )); then
    local joined=""
    for extra in "${extras[@]}"; do
      if [[ -n "$joined" ]]; then
        joined+="; "
      fi
      joined+="$extra"
    done
    suffix=" (${joined})"
  fi
  printf '%s %s%s' "$label" "$icon" "$suffix"
}

ensure_postgres() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker bulunamadı; Postgres'i manuel başlatman gerekir."
    return 0
  fi
  if docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    log "Postgres konteyneri zaten çalışıyor (${POSTGRES_CONTAINER})."
  else
    log "Postgres konteyneri başlatılıyor…"
    docker compose -f docker-compose.postgres.yml up -d postgres
  fi
}

run_prisma() {
  log "Prisma client generate"
  npm run -s db:generate
  log "Prisma migrate deploy"
  npm run -s db:migrate
  if [[ "${RLS_AUTO_APPLY:-}" == "true" ]]; then
    log "RLS auto apply (npm run db:rls:auto)"
    npm run -s db:rls:auto || warn "RLS auto apply başarısız oldu"
  fi
}

do_status() {
  analyze_recent_events
  load_restart_state
  local port url rc=0
  port="$(resolve_port)"
  url="http://127.0.0.1:${port}${HEALTH_PATH}"
  local restart_identity=0 restart_admin=0 restart_spa=0 restart_suite=0
  local did_restart_identity=0 did_restart_admin=0 did_restart_spa=0 did_restart_suite=0
  local status_identity=0 status_admin=0 status_spa=0 status_suite=0

  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    ok "Docker: ${POSTGRES_CONTAINER} ayakta"
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U taxipartner -d taxipartner_dev >/dev/null 2>&1; then
      ok "Postgres hazır"
    else
      warn "Postgres hazır değil (pg_isready başarısız)"
    fi
  else
    warn "Postgres konteyneri (${POSTGRES_CONTAINER}) çalışmıyor ya da docker erişilemedi."
  fi

  if port_in_use "$port"; then
    ok "Identity portu $port dinleniyor"
  else
    warn "Identity portu $port dinlenmiyor"
    restart_identity=1
    status_identity=1
  fi

  if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
    ok "Health 200 → $url"
    reset_restart identity
  else
    warn "Health yanıt vermiyor → $url"
    restart_identity=1
    status_identity=1
  fi
  if report_port "$ADMIN_PORT" "Admin UI (5173)" "http://127.0.0.1:${ADMIN_PORT}"; then
    rc=0
  else
    rc=$?
  fi
  if (( rc == 1 || rc == 2 )); then
    restart_admin=1
    status_admin=1
  else
    reset_restart admin
  fi
  if report_port "$SPA_PORT" "Identity SPA (5174)" "http://127.0.0.1:${SPA_PORT}"; then
    rc=0
  else
    rc=$?
  fi
  if (( rc == 1 || rc == 2 )); then
    restart_spa=1
    status_spa=1
  else
    reset_restart spa
  fi
  if report_port "$ADMIN_SUITE_PORT" "Taxipartner Admin (5179)" "http://127.0.0.1:${ADMIN_SUITE_PORT}"; then
    rc=0
  else
    rc=$?
  fi
  if (( rc == 1 || rc == 2 )); then
    restart_suite=1
    status_suite=1
  else
    reset_restart suite
  fi
  if curl -fsS --max-time 2 "http://127.0.0.1:${OPA_PORT}/health" >/dev/null 2>&1; then
    ok "OPA health OK (http://127.0.0.1:${OPA_PORT}/health)"
  else
    warn "OPA sidecar kapalı (http://127.0.0.1:${OPA_PORT}/health)."
  fi

  if (( restart_identity )); then
    if increment_restart identity; then
      warn "Identity API yeniden başlatılıyor…"
      kill_on_port "$port"
      ensure_identity
      tail_log_snippet "${PROJECT_DIR}/.tp.identity.log" "Identity"
      did_restart_identity=1
      status_identity=0
      reset_restart identity
      append_event "restart identity success"
    else
      status_identity=2
      append_event "restart identity skipped (limit)"
    fi
  fi
  if (( restart_admin )); then
    if increment_restart admin; then
      warn "Admin UI yeniden başlatılıyor…"
      kill_on_port "$ADMIN_PORT"
      ensure_admin_ui
      tail_log_snippet "${PROJECT_DIR}/.tp.admin.log" "Admin UI"
      did_restart_admin=1
      status_admin=0
      reset_restart admin
      append_event "restart admin success"
    else
      status_admin=2
      append_event "restart admin skipped (limit)"
    fi
  fi
  if (( restart_spa )); then
    if increment_restart spa; then
      warn "Identity SPA yeniden başlatılıyor…"
      kill_on_port "$SPA_PORT"
      ensure_frontend_spa
      tail_log_snippet "${PROJECT_DIR}/.tp.frontend.log" "Identity SPA"
      did_restart_spa=1
      status_spa=0
      reset_restart spa
      append_event "restart spa success"
    else
      status_spa=2
      append_event "restart spa skipped (limit)"
    fi
  fi
  if (( restart_suite )); then
    if increment_restart suite; then
      warn "Taxipartner Admin yeniden başlatılıyor…"
      kill_on_port "$ADMIN_SUITE_PORT"
      ensure_taxipartner_admin
      tail_log_snippet "${PROJECT_DIR}/.tp.taxipartner-admin.log" "Taxipartner Admin"
      did_restart_suite=1
      status_suite=0
      reset_restart suite
      append_event "restart suite success"
    else
      status_suite=2
      append_event "restart suite skipped (limit)"
    fi
  fi

  local summary_identity summary_admin summary_spa summary_suite summary
  summary_identity="$(format_summary 'Identity' "$status_identity" "$did_restart_identity")"
  summary_admin="$(format_summary 'Admin UI' "$status_admin" "$did_restart_admin")"
  summary_spa="$(format_summary 'SPA' "$status_spa" "$did_restart_spa")"
  summary_suite="$(format_summary 'Admin Suite' "$status_suite" "$did_restart_suite")"
  summary="Özet → ${summary_identity} | ${summary_admin} | ${summary_spa} | ${summary_suite}"
  if [[ "$OUTPUT_JSON" != "1" && "$QUIET_MODE" != "1" ]]; then
    log "$summary"
  fi
  append_event "$summary"

  if [[ "$OUTPUT_JSON" == "1" ]]; then
    printf '{"identity":{"status":%d,"restarted":%d},"admin":{"status":%d,"restarted":%d},"spa":{"status":%d,"restarted":%d},"suite":{"status":%d,"restarted":%d},"forceClean":%s,"maxRestart":%d,"healthTimeout":%d,"smoke":%s}\n' \
      "$status_identity" "$did_restart_identity" \
      "$status_admin" "$did_restart_admin" \
      "$status_spa" "$did_restart_spa" \
      "$status_suite" "$did_restart_suite" \
      "${FORCE_CLEAN:-0}" "$MAX_RESTART" "$HEALTH_WAIT" "${SMOKE_ENABLED:-0}"
  elif [[ "$QUIET_MODE" == "1" ]]; then
    printf '%s\n' "$summary"
  fi
}

do_check() {
  ensure_env
  ensure_postgres
  run_prisma
  if command -v make >/dev/null 2>&1; then
    log "RLS reset (make rls-reset)"
    make rls-reset || warn "rls-reset başarısız oldu"
  fi
  ok "Kontroller tamamlandı."
}

start_auto_release() {
  if [[ "${TP_AUTO_RELEASE:-0}" == "1" ]]; then
    if pgrep -f "watch:auto-release" >/dev/null 2>&1; then
      log "Auto-release watcher zaten çalışıyor."
    else
      log "Auto-release watcher başlatılıyor…"
      nohup npm run -s watch:auto-release >"${PROJECT_DIR}/.tp.auto-release.log" 2>&1 &
    fi
  fi
}

ensure_opa() {
  if [[ "${TP_POLICY_DEV:-1}" == "1" ]]; then
    if curl -fsS --max-time 2 "http://127.0.0.1:${OPA_PORT}/health" >/dev/null 2>&1; then
      log "OPA dev sidecar zaten çalışıyor."
    else
      log "OPA dev sidecar başlatılıyor…"
      make policy-up || npm run -s opa:start || warn "OPA sidecar başlatılamadı."
    fi
  else
    warn "TP_POLICY_DEV=0 → OPA dev sidecar atlandı."
  fi
}

report_port() {
  local port="$1" label="$2" url="${3:-}"
  if port_in_use "$port"; then
    if [[ -n "$url" ]]; then
      if probe_http "$url"; then
        ok "$label ayakta (:$port)"
        return 0
      else
        local rc=$?
        if (( rc == 2 )); then
          warn "$label dinleniyor fakat HTTP kontrolü yapılamadı (curl/wget yok) (:$port$(port_process_info "$port"))"
          return 3
        fi
        warn "$label dinleniyor ama yanıt vermiyor (:$port → $url$(port_process_info "$port"))"
        return 1
      fi
    else
      ok "$label dinleniyor (:$port)"
      return 0
    fi
  else
    warn "$label kapalı (:$port)"
    return 2
  fi
}

ensure_identity() {
  local port url log_file
  port="$(resolve_port)"
  url="http://127.0.0.1:${port}${HEALTH_PATH}"
  if wait_http "$url" 1; then
    ok "Identity API zaten ayakta (${url})"
    return 0
  fi
  if port_in_use "$port"; then
    warn "Identity API portu $port yanıt vermiyor, süreç sonlandırılıyor$(port_process_info "$port")"
    kill_on_port "$port"
    sleep 1
  fi
  log "Identity API başlatılıyor (${url})…"
  log_file="${PROJECT_DIR}/.tp.identity.log"
  truncate_file "$log_file"
  nohup npm --prefix identity run dev >"$log_file" 2>&1 &
  if wait_http "$url" "$HEALTH_WAIT"; then
    ok "Identity API hazır → $url"
  else
    err "Identity health alınamadı; log: $log_file"
    tail -n 120 "$log_file" || true
    exit 1
  fi
}

ensure_admin_ui() {
  local log_file="${PROJECT_DIR}/.tp.admin.log"
  local css_log="${PROJECT_DIR}/.tp.admin.css.log"
  local vite_log="${PROJECT_DIR}/.tp.admin.vite.log"
  local url="http://127.0.0.1:${ADMIN_PORT}"
  if port_in_use "$ADMIN_PORT"; then
    if probe_http "$url"; then
      ok "Admin UI (:$ADMIN_PORT) ayakta"
      return 0
    fi
    warn "Admin UI portu $ADMIN_PORT yanıt vermiyor, süreç sonlandırılıyor$(port_process_info "$ADMIN_PORT")"
    kill_on_port "$ADMIN_PORT"
    sleep 1
  fi
  log "Admin UI dev server başlatılıyor (dev:css + dev:vite)…"
  truncate_file "$log_file"
  truncate_file "$css_log"
  truncate_file "$vite_log"
  pkill -f 'npm run -s dev:css' >/dev/null 2>&1 || true
  pkill -f 'npm run -s dev:vite' >/dev/null 2>&1 || true
  nohup npm run -s dev:css >"$css_log" 2>&1 &
  nohup npm run -s dev:vite -- --host --port "$ADMIN_PORT" >"$vite_log" 2>&1 &
  if wait_http "$url" "$HEALTH_WAIT"; then
    ok "Admin UI hazır → $url"
  else
    err "Admin UI portu açılmadı; loglar: $vite_log | $css_log"
    tail -n 120 "$vite_log" || true
    tail -n 60 "$css_log" || true
    exit 1
  fi
}

ensure_frontend_spa() {
  local log_file="${PROJECT_DIR}/.tp.frontend.log"
  local url="http://127.0.0.1:${SPA_PORT}"
  if port_in_use "$SPA_PORT"; then
    if probe_http "$url"; then
      ok "Identity SPA (:$SPA_PORT) ayakta"
      return 0
    fi
    warn "Identity SPA portu $SPA_PORT yanıt vermiyor, süreç sonlandırılıyor$(port_process_info "$SPA_PORT")"
    kill_on_port "$SPA_PORT"
    sleep 1
  fi
  log "Identity SPA dev server başlatılıyor…"
  truncate_file "$log_file"
  nohup npm --prefix frontend run dev -- --host --port "$SPA_PORT" >"$log_file" 2>&1 &
  if wait_http "$url" "$HEALTH_WAIT"; then
    ok "Identity SPA hazır → $url"
  else
    err "Identity SPA portu açılmadı; log: $log_file"
    tail -n 120 "$log_file" || true
    exit 1
  fi
}

ensure_taxipartner_admin() {
  local log_file="${PROJECT_DIR}/.tp.taxipartner-admin.log"
  local url="http://127.0.0.1:${ADMIN_SUITE_PORT}"
  if port_in_use "$ADMIN_SUITE_PORT"; then
    if probe_http "$url"; then
      ok "Taxipartner Admin (:$ADMIN_SUITE_PORT) ayakta"
      return 0
    fi
    warn "Taxipartner Admin portu $ADMIN_SUITE_PORT yanıt vermiyor, süreç sonlandırılıyor$(port_process_info "$ADMIN_SUITE_PORT")"
    kill_on_port "$ADMIN_SUITE_PORT"
    sleep 1
  fi
  log "taxipartner-admin Vite server başlatılıyor…"
  truncate_file "$log_file"
  nohup npm --prefix taxipartner-admin run dev -- --host --port "$ADMIN_SUITE_PORT" >"$log_file" 2>&1 &
  if wait_http "$url" "$HEALTH_WAIT"; then
    ok "taxipartner-admin hazır → $url"
  else
    err "taxipartner-admin portu açılmadı; log: $log_file"
    tail -n 120 "$log_file" || true
    exit 1
  fi
}

run_smoke_tests() {
  if [[ "$SMOKE_ENABLED" != "1" ]]; then
    return 0
  fi
  log "Smoke testleri çalıştırılıyor…"
  local fail=0
  local base_port; base_port="$(resolve_port)"
  local tests=(
    "Identity API|$(health_url)"
    "Admin UI|http://localhost:${ADMIN_PORT}"
    "Identity SPA|http://localhost:${SPA_PORT}"
    "Admin Suite|http://localhost:${ADMIN_SUITE_PORT}"
  )
  for entry in "${tests[@]}"; do
    local name="${entry%%|*}"
    local test_url="${entry#*|}"
    if curl -sS --max-time 5 "$test_url" >/dev/null 2>&1; then
      ok "Smoke: $name ✓ ($test_url)"
    else
      warn "Smoke: $name başarısız ($test_url)"
      append_event "smoke.fail ${name}"
      fail=1
    fi
  done
  if (( fail )); then
    warn "Smoke testleri başarısız."
    return 1
  fi
  append_event "smoke.pass"
  ok "Smoke testleri geçti."
}

do_up() {
  local port url
  port="$(resolve_port)"
  url="http://127.0.0.1:${port}${HEALTH_PATH}"

  analyze_recent_events
  local already_healthy=0

  if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
    log "Identity health zaten 200 → $url (servisler yine kontrol edilecek)"
    already_healthy=1
  fi

  if [[ "$FORCE_CLEAN" == "1" ]]; then
    log "Force clean modu etkin → servis portları kapatılıyor."
    force_clean_ports
    already_healthy=0
  fi

  if [[ "${TP_FORCE_CHECK:-0}" == "1" ]]; then
    already_healthy=0
  fi

  if (( ! already_healthy )); then
    if port_in_use "$port" && [[ "${TP_KILL_STALE:-0}" == "1" ]]; then
      local extra="${TP_KILL_PORTS:-$port $((port+1)) $ADMIN_PORT $SPA_PORT 5175 5176 $ADMIN_SUITE_PORT}"
      for p in $extra; do
        kill_on_port "$p"
      done
    elif port_in_use "$port" && [[ "${TP_KILL_STALE:-0}" != "1" ]]; then
      warn "Port $port kullanımda; TP_KILL_STALE=1 ile otomatik temizleyebilirsin."
    fi
    do_check
  else
    log "Kontrol adımı atlandı (Identity zaten ayakta)."
  fi

  ensure_identity
  ensure_opa
  ensure_admin_ui
  ensure_frontend_spa
  ensure_taxipartner_admin
  start_auto_release
  if ! run_smoke_tests; then
    warn "Smoke testleri başarısız oldu. Servisleri kontrol et."
  fi
  ok "✅ Geliştirme portları hazır."
}

do_test() {
  if command -v make >/dev/null 2>&1; then
    log "RLS reset"
    make rls-reset || warn "rls-reset başarısız oldu"
    log "Tenant seed"
    make seed-tenants || warn "seed-tenants başarısız oldu"
  else
    warn "make bulunamadı; RLS komutları atlandı."
  fi
  log "RLS testleri (DATABASE_URL=$APP_URL_DEFAULT)"
  DATABASE_URL="$APP_URL_DEFAULT" npm run -s test:rls
  log "OPA policy testleri"
  npm run -s policy:test
  ok "Tüm testler tamamlandı."
}

do_stop() {
  local stop_db="${1:-0}"
  local pats=("npm run codespaces:start" "npm run dev:web" "frontend run dev" "taxipartner-admin run dev" "vite" "tailwind" "tsx" "node .*src/server\.ts" "watch:auto-release" "policyshim/server")
  local killed=false
  for pat in "${pats[@]}"; do
    local pids
    pids="$(pgrep -f "$pat" || true)"
    if [[ -n "${pids:-}" ]]; then
      for pid in $pids; do
        warn "PID $pid sonlandırılıyor ($pat)"
        kill "$pid" 2>/dev/null || true
      done
      killed=true
    fi
  done
  if [[ "${TP_POLICY_DEV:-1}" == "1" ]]; then
    make policy-down >/dev/null 2>&1 || true
  fi
  if [[ "$stop_db" == "1" ]]; then
    log "Postgres konteyneri kapatılıyor (istek üzerine)."
    docker compose -f docker-compose.postgres.yml down >/dev/null 2>&1 || true
  else
    log "Postgres açık bırakıldı (TP_DB_DOWN=1 veya 'tp stop db' ile kapatılabilir)."
  fi
  $killed && ok "Dev süreçleri durduruldu." || warn "Durduracak süreç bulunamadı."
}

do_health() {
  local url; url="$(health_url)"
  curl -i --max-time 5 "$url" || true
}

do_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    warn "GitHub CLI yüklü değil. (gh auth login) ile giriş yapabilirsin."
    return 0
  fi
  gh --version || true
  gh auth status || true
}

do_gh_sync() {
  if ! command -v git >/dev/null 2>&1; then
    err "git komutu bulunamadı."
    return 1
  fi

  local branch dirty=0
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

  if [[ "$OUTPUT_JSON" == "1" ]]; then
    git status --short --branch --porcelain=v2 | jq -R -s 'split("\n")' || true
  fi

  if [[ "$QUIET_MODE" != "1" ]]; then
    log "Git sync başlatılıyor (branch=$branch)…"
  fi

  if ! git status --short >/tmp/git_status.txt 2>/dev/null; then
    warn "git status alınamadı."
    return 1
  fi

  if [[ -s /tmp/git_status.txt ]]; then
    dirty=1
  fi

  if (( dirty == 0 )); then
    if [[ "$QUIET_MODE" != "1" ]]; then
      ok "Çalışma dizini temiz; senkronize edilecek dosya yok."
    fi
    return 0
  fi

  local commit_msg="chore(sync): tp gh sync"
  git add -A
  if git diff --cached --quiet; then
    ok "Stage edilecek değişiklik bulunmadı."
  else
    HUSKY=0 git commit -m "$commit_msg"
    ok "Commit oluşturuldu: $commit_msg"
  fi

  if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    git push
    ok "Değişiklikler remote'a pushlandı."
  else
    warn "Takip edilen remote branch yok; git push --set-upstream origin $branch komutunu elle çalıştır."
  fi
}

# ----- policy shim helpers -----
shim_start() {
  local port="${POLICY_SHIM_PORT:-$POLICY_DEFAULT_PORT}"
  export POLICY_SHIM_PORT="$port"
  log "Policy shim ${port} portunda başlatılıyor…"
  nohup npm run -s policy:shim:start >/dev/null 2>&1 &
  sleep 0.3
  if wait_http "http://127.0.0.1:${port}/health" 60; then
    ok "Policy shim hazır @ ${port}"
  else
    err "Policy shim health başarısız."
    tail -n 120 /tmp/policy.shim.log || true
    exit 1
  fi
}

shim_stop() {
  log "Policy shim durduruluyor…"
  npm run -s policy:shim:stop || true
  ok "Policy shim durduruldu."
}

authz_test() {
  bash scripts/test-authz.sh
}

watch_authz() {
  local interval="${1:-60}"
  log "Authz testi her ${interval}s'de bir çalışacak (Ctrl+C ile çık)."
  while true; do
    local ts rc
    ts="$(date +%F' '%T)"
    if bash scripts/test-authz.sh >/tmp/test.authz.out 2>&1; then
      echo "[$ts] PASS" | tee -a /tmp/test.authz.watch.log
    else
      rc=$?
      echo "[$ts] FAIL (rc=$rc)" | tee -a /tmp/test.authz.watch.log
      tail -n 100 /tmp/policy.shim.log >> /tmp/test.authz.watch.log 2>/dev/null || true
    fi
    sleep "$interval"
  done
}

usage() {
  cat <<'EOF'
Usage: tp <command>

Ana komutlar
  status   → Docker/pg, port ve /health durumunu göster
  check    → identity/.env, Prisma generate+migrate, RLS reset
  up       → check + OPA + dev süreçlerini başlat (TP_KILL_STALE=1 ile port temizler)
  test     → RLS + OPA testleri
  stop [db]→ Dev süreçlerini kapat (db ile Postgres'i de kapatır)
  health   → /health uç noktasını sorgula
  gh       → GitHub CLI durumunu yazdır

Policy shim & test yardımcıları
  shim:start        → Policy shim'i başlat (POLICY_SHIM_PORT=3300 varsayılan)
  shim:stop         → Policy shim'i durdur
  test:authz        → Yetkilendirme e2e paketini çalıştır
  watch:authz [sn]  → authz testini periyodik tekrar et

Çevresel değişkenler
  PORT               Varsayılan 3001 (identity/.env'den okunur)
  TP_KILL_STALE=1    up öncesi ilgili portları otomatik kapatır
  TP_KILL_PORTS      Ek port listesi (varsayılan: PORT, PORT+1, 5173-5176, 5179)
  TP_HEALTH_TIMEOUT  up sonrası health bekleme süresi (saniye, varsayılan 90)
  TP_POLICY_DEV=0    OPA sidecar başlatma
  TP_AUTO_RELEASE=1  up çağrısında auto-release watcher'ı başlat
  TP_DB_DOWN=1       stop sırasında Postgres'i de kapat
EOF
}

main() {
  case "${1:-help}" in
    status)      do_status ;;
    check)       do_check ;;
    up)          do_up ;;
    test)        do_test ;;
    stop)
      local stop_db_flag=0
      if [[ "${2:-}" =~ ^(--db|db)$ ]]; then
        stop_db_flag=1
      fi
      if [[ "${TP_DB_DOWN:-0}" == "1" ]]; then
        stop_db_flag=1
      fi
      do_stop "$stop_db_flag"
      ;;
    health)      do_health ;;
  gh)          do_gh ;;
  gh:sync)     do_gh_sync ;;
    shim:start)  shim_start ;;
    shim:stop)   shim_stop ;;
    test:authz)  authz_test ;;
    watch:authz) watch_authz "${2:-60}" ;;
    help|"")     usage ;;
    *)
      err "Bilinmeyen komut: $1"
      usage
      exit 1
      ;;
  esac
}
main "$@"
