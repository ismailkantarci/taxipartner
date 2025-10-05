# taxipartner

## Scripts
- `npm i` – install deps
- `npm run dev` – vite dev server
- `npm run build` – vite build + tailwind css build
- `npm test` – vitest unit tests
- `npm run sandbox` – docs/style-sandbox.html için hafif statik sunucu (QA/görsel inceleme)

For Release Management UX changes and usage tips see:
- `docs/ReleaseManagement-UX.md`

## Architecture
- Entry: `modules/core.app/main.js`
- Router: `modules/core.router/` (hash router, guard + 404)
- Loader: `modules/core.moduleLoader/` (manifest + sanitize + dispose)
- State: `modules/core.state/` (theme/i18n fallback)
- UI: `modules/core.header/`, `modules/core.sidebar/`, feature modules under `modules/*`

## Security
- CSP in `index.html` is strict (no inline scripts/styles). `img-src` izinleri: `self`, data URIs ve `ui-avatars.com`.
  - Policy artık ortam değişkeni üzerinden geliyor: `.env.production` sıkı politika, `.env.development` geliştirici ortamı için `unsafe-inline / unsafe-eval` izinleri ekliyor.
- Manifest HTML sanitize ediliyor: `script/iframe/object/embed/link/style` etiketleri, tüm `on*` handler'lar ve `javascript:` URL’leri engellenir.
- Service Worker sadece scope içi statik varlıkları ve navigation shell’i cache’ler; API yanıtları cache’lenmez.

## Testing
- Vitest unit tests in `tests/`
- Added sanitizer test to assert `style` attributes are stripped.
- CI: `.github/workflows/ci.yml`

## Tailwind
- Config: `tailwind.config.js`
- Source: `src/styles/tailwind.css` (includes toast component classes)
- Output: `dist/output.css`

## Service Worker
- Uses relative asset paths so subpath deployments work.
- Strategies: navigation = network-first with offline fallback; static assets = cache-first; non-static/API requests are bypassed.
- Registration respects `app.config.json > features.serviceWorker` (defaults to true) and runs only on `https` or `localhost`.

## Audit Automation
- Every push to `main/master` triggers an audit job that:
  - extracts commit info (author, message, changed files),
  - appends it to `audit/audit.log.json` (deduplicated by commit SHA),
  - regenerates `AUDITLOG.md` (latest first).
- Local usage: `node scripts/generate-audit.mjs` (or CI will run it).
- Files:
  - `scripts/generate-audit.mjs`: audit generator
  - `AUDITLOG.md`: human-friendly summary
  - `audit/audit.log.json`: structured log for tooling
- `.github/workflows/audit.yml`: automation

## Local Auto‑Release (Semantic)
- Hooks: Husky `pre-commit` çalışır ve yeni bir release girdisi oluşturur. CI tarafında semantik artış devreye girer (feat → minor, BREAKING → major, diğerleri → patch). Yerelde patch artışı uygulanır; CI push’taki commit mesajlarına göre gerekirse bir üst seviyeye çıkar.
- Enable locally: ensure Node is installed; run `npm i` (triggers `npm run prepare` → `husky install`).
- Manual trigger: `npm run release:auto`.
- Node yoksa: `.githooks/pre-commit` ile Python fallback devrede. Etkinleştirmek için bir kez `git config core.hooksPath .githooks` çalıştırın. Bu yol, Node olmadan da patch +1 ve release-log oluşturur.

### Git olmadan (tamamen dosya-tabanlı izleme)
- Sürekli izleme (ön yüz): `python3 scripts/local_watch_auto_release.py --interval 5`
  - Çalıştığı sürece değişiklikleri (dosya ekle/değiştir/sil) tarar, uygun bulduğunda patch +1 artırır ve yeni release girişi oluşturur.
  - Kayıt: `modules/ReleaseManagement/release-log.json`
  - Sürüm: `package.json`, `system.meta.json`, `modules/**/module.manifest.json`
- Arka plan servis tarzı kullanım (macOS/Linux):
  - Başlat: `bash scripts/local_watch.sh start` (varsayılan 5 sn, `INTERVAL=3 bash scripts/local_watch.sh start`)
  - Durum: `bash scripts/local_watch.sh status`
  - Durdur: `bash scripts/local_watch.sh stop`
  - Log: `.local_watch.log`
 - macOS LaunchAgent: `bash scripts/install_launchagent.sh` (kaldır: `bash scripts/uninstall_launchagent.sh`)
 - Linux systemd (user): `bash scripts/install_systemd_user.sh` (kaldır: `bash scripts/uninstall_systemd_user.sh`)

## Compare Panel ve Tek-Satır Eylemleri
- Üst bar: A/B versiyon seç, `Diff` ile yan panelde karşılaştır; repoUrl tanımlıysa GitHub linki görünür.
- Repo linkini etkinleştirmek için: `scripts/set_repo_url.py --url https://github.com/org/repo` komutunu çalıştırın (CI ve yerel UI aynı adresi kullanır).
- Satır eylemleri: `JSON`, `MD`, `Copy` (panoya açıklama) — Version hücresinde.
- Telemetry: sayfalama/sıralama/kolon değişimi/karşılaştırma/export olayları anonim lokal kayıt altına alınır (localStorage tabanlı).
 
## Multi‑language Release Notes
- `modules/ReleaseManagement/release-log.json` açıklamaları çok dilli nesne olarak tutar: `{ "tr": "…", "de": "…", "en": "…" }`.
- Eksik diller CI’da `[DRAFT]` ile otomatik doldurulur (onay/son düzenleme için).
- Changelog çıktıları: `CHANGELOG.md` (en), `CHANGELOG.de.md`, `CHANGELOG.tr.md`.

## Releases & Governance
- Version Sync: `npm run version:sync` updates `system.meta.json` and all `module.manifest.json` files with the version from `package.json`, and stamps build date.
- Changelog: `npm run changelog` generates `CHANGELOG.md` from `modules/ReleaseManagement/release-log.json`.
- GitHub Release: push a tag like `v1.3.1` to run the Release workflow, sync metadata, regenerate `CHANGELOG.md` and publish a GitHub Release (attaches `dist/output.css`).
- Dependabot: weekly dependency updates for npm and GitHub Actions (`.github/dependabot.yml`).
- CodeQL: static analysis for JavaScript (`.github/workflows/codeql.yml`).
- Conventional Commits: commit message lint on PRs (`.github/workflows/commitlint.yml`).
 - Release descriptions support multi-language JSON. Use:
   - `description: { "tr": "…", "de": "…", "en": "…" }`
   - UI and exports use the active language; JSON export preserves all.

### Governance Documents
- `release-policy.md`: classification (major/minor/patch/emergency), approval, backout, calendar, traceability.
- `release-calendar.yml`: maintenance windows and freeze periods.
- `risk-matrix.yml`: risk scoring and required gates.
- `post-implementation-review.md`: PIR template.

### Release Package Standard
- `release-pack/` includes: artefacts, `sbom.json` (CycloneDX), `checksums.txt` (SHA256), `RELEASE_NOTES.md`, `MANIFEST.json`.
- Commands: `npm run release:pack`, `npm run sbom`, `npm run license:report`.
- Release workflow (`.github/workflows/release.yml`) builds the package, runs npm audit, and publishes assets.

### Environments & Deploy
- Workflows: `deploy-qa.yml`, `deploy-staging.yml`, `deploy-prod.yml` (uses GitHub Environments; set required reviewers in repo settings).
- Rollback: `rollback.yml` (repository_dispatch triggered).

### PR & Issue Hygiene
- PR must reference an issue (e.g., `Closes #123`). Enforced by `.github/workflows/pr-issue-link.yml`.

## Module-level Automation
- Per-module audit: any change under `modules/<Name>/` updates `modules/<Name>/audit.log.json` and `modules/<Name>/AUDIT.md`, and stamps `lastUpdated` in that module's `module.manifest.json`.
- New module scaffold: `node scripts/scaffold-module.mjs <ModuleName>` creates a ready-to-use module folder with manifest, entry file and audit files.
- Manifest validation: `npm run validate:modules` validates every `module.manifest.json` (name, entry, version, type).

## Feature Flags & Canary
- Define flags in `app.config.json > flags`. Supported fields: `enabled` (bool), `rollout` (0-100), `seed`, `users[]`, `tenants[]`.
- Runtime helper: `AppState.isFlagEnabled('flag.name')` returns a stable result per user (hash-bucket rollout).
- Example: `release.canaryUi` with 10% rollout; UI shows a small Canary badge in Release Management when enabled.

## Provenance & SBOM
- Release package includes `sbom.json` (CycloneDX), `checksums.txt` (SHA256) and `provenance.json` (minimal SLSA-like info).

## DORA Metrics & PIR
- Nightly job aggregates DORA metrics into `metrics/dora.json` and `metrics/DORA.md`.
- After each Release, a PIR draft file is created under `pir/` from the template `post-implementation-review.md`.
## Deep Links & Unsaved Changes

- Detail deep-link: `#/releases?v=1.3.139` opens the details modal for that version on load. Closing the modal removes `?v`.
- Compare deep-link: `#/releases?cmp=1.3.138..1.3.139` opens the compare panel. Closing removes `?cmp`.
- Unsaved changes: After edits/import/final/delete, a save banner is shown via the action menu. Navigating away (refresh/close) warns the user until JSON is saved (dev writes via `/api/release-log`, otherwise downloads the file).

## 4-Eyes UI
- `#/users` sayfasındaki kullanıcı detayında “Zeige Genehmigungen” butonuna tıklayarak onay listesini açabilirsiniz.
- Bekleyen onaylar uygunsa “Onayla” butonu ile tamamlanabilir.
- Gerekli backend uçları:
  - `POST /approval/start`
  - `GET /approval/list`
  - `POST /approval/:id/apply`

## Approval UI – Start & List
- Backend uçları: `/approval/start`, `/approval/list`, `/approval/:id/apply`
- Frontend: `#/users` detay ekranında “Genehmigungen anzeigen / starten” butonuna tıklayarak formu açın.
  - İşlem (op) ve tenant seçin, isteği başlatın; yetkili kullanıcılar bekleyen talepleri onaylayabilir.

## Persistence & Auth
- DB: PostgreSQL via Prisma (`DATABASE_URL` in .env, see docker-compose)
- Auth: /auth/register, /auth/login, /auth/totp/setup, /auth/totp/verify
- Invite: /auth/invite → /auth/invite/accept
- JWT bearer required for /api/* and /approval/*

### Setup
```bash
cp .env.example .env
npm install
npm run db:up
npm run db:gen
npm run db:migrate
npm run db:seed
npm run identity:dev
```

### 18A – Part 5 (Prisma & Seed)
- Ensure schema is in sync:
  ```bash
  npm run db:ensure
  ```
- Seed a demo user + tenant for quick UI verification:
  ```bash
  npm run seed:mp18
  ```
  Optional overrides: set `SEED_USER_EMAIL` / `SEED_TENANT_CODE` before running.

## Permission & Scope Guards
- **permissionGuard(required: string[])**  
  Checks role→permission templates. Wildcards `.*` supported.
- **scopeGuard()**  
  Ensures request’s tenantId (and ouId if given) is within user.claims.

### Example
```ts
app.post(
  "/api/finance/report",
  permissionGuard(["tp.finance.report.read"]),
  scopeGuard(),
  handler
);
```

## Identity Dev Bypass (Temporary)
- `identity/src/env.ts` ve `identity/src/authGuard.ts` dosyalarında `DEV_BYPASS_AUTH` / `DEV_BYPASS_EMAIL` değişkenleri dev ortamında otomatik oturum açma sağlar. Kullanıcı yoksa Superadmin rolüyle oluşturulur.
- `identity/.env` ve `.env.example` dosyalarında Postgres bağlantı dizesi ve dev bypass satırları bulunur.
- `DEV_RUNBOOK.md` notları buna göre güncellendi.

Prod hazırlığına geçmeden yapılması gerekenler:
1. `identity/.env` içinde `DEV_BYPASS_AUTH` satırını devre dışı bırak.
2. `identity/src/authGuard.ts` içindeki bypass logic’ini kaldır.
3. Gerekirse `env.ts`, `.env.example` ve dokümantasyondaki dev bypass referanslarını temizle.

## Production Hardening: Postgres + Backup + Audit Export

### Database (Postgres via Docker)
```bash
npm run db:up            # start postgres in docker
npm run db:gen          # generate prisma client
npm run db:migrate      # run migrations
npm run db:seed         # seed base roles/users
npm run identity:dev    # start identity server (dev bypass stays for local)
```

### Backup & Restore
```bash
npm run db:backup
npm run db:restore -- backups/taxipartner-YYYY-MM-DDTHH-MM-SS.sql
```

- Backup dosyaları `backups/` klasörüne `.sql` olarak düşer (pg_dump plain format).
- Restore işlemi seçilen `.sql` dosyasını Postgres’e uygular.

### Audit Package Export
- Korunan uç: `GET /export/audit-package?tenantId=TENANT&from=2025-01-01&to=2025-01-31`
- `Wirtschaftsprüfer` veya `Superadmin` rolü gerekli.
- ZIP içeriği:
  - `audit.json`: sabit sırayla JSON (bütün kayıtlar için yer tutucu / TODO gerçek veri).
  - `manifest.json`: dosya özetleri ve meta.
  - `SIGN.txt`: `EXPORT_SIGN_SECRET` HMAC-SHA256 imzası.

### Disable Dev Bypass Before Production
- `DEV_BYPASS_AUTH` değerini `false` yap veya sil.
- `identity/src/authGuard.ts` içindeki bypass bloklarını kaldır.
- `EXPORT_SIGN_SECRET` için güçlü ve gizli değer kullan.
- `docker compose` ile Postgres için kalıcı storage ve erişim politikalarını gözden geçir.

## CI/CD (GitHub Actions)
- **CI**: `.github/workflows/ci.yml`
  - Postgres service for tests
  - Prisma gen + migrate
  - Tests + (on main/release) Prod Gate check (`npm run prod:guard`)
  - Optional Docker image publish to GHCR if `Dockerfile` exists
- **CD**: `.github/workflows/cd.yml` (placeholder)
  - Manual dispatch, wire your infra

### Branch Policy Suggestion
- `main` / `release/*`: require CI green + `prod:guard`
- feature branches: CI without `prod:guard`

### Secrets (in repo settings → Actions Secrets)
- `DATABASE_URL` (if you prefer using secret over inline service URL)
- `JWT_SECRET`
- `EXPORT_SIGN_SECRET`
- (Optional) Registry creds if not using GHCR

### Dev Bypass Reminder
CI sets `DEV_BYPASS_AUTH=false`. Local dev may keep it true. **Production must disable it**.

## Invite → Accept → TOTP (Dev Flow)
**Backend**
- POST `/invite/create` → body `{ email, roles[], claims?, baseUrl? }` → `{ inviteToken, emailPreviewUrl }`
- POST `/invite/accept`  → body `{ token, password, totp?: { setup?: boolean, code?: string } }`
- GET  `/auth/me`        → dev auth status

**Frontend**
- `#/invite/accept?token=...` → kabul et, istersen TOTP kur (QR görüntülenir).
- `#/auth/login` → login; token `localStorage.token`.

**Dev e-mail preview**
- Response içindeki `emailPreviewUrl`’yi tarayıcıda aç.

**Run**
- Backend: `npm run identity:dev`
- Frontend (SPA): `npm run dev --prefix frontend` (port 5174, Vite)

NOTES
- Üretimde gerçek SMTP ve gizli yönetimi sağlayın.
- `permissionGuard` / `scopeGuard` ile kritik uçları korumaya devam edin.

## Benutzerverwaltung — Backend APIs
- `GET  /api/users?q=&skip=&take=` → listeler `{ id, email, roles[], mfaEnabled, sessionsCount }`
- `GET  /api/users/:id` → detay `{ id, email, roles[], claims, mfaEnabled, sessions[] }`
- `POST /api/users { email }` → demo kullanıcı oluşturur
- `POST /api/users/:id/assign { role, claims? }` → rol atar (`roleGuard.assignRole` kullanır)
- `POST /api/users/:id/revoke` → tüm oturumları kapatır
- Hatalar Türkçe, okunabilir mesaj üretir.

## Benutzerverwaltung – Frontend API (Part 2/4)
- API clients:
  - `frontend/users/users.api.ts` → list/get/create/assign/revoke
  - `frontend/users/roles.api.ts` → rolleri listeler
  - Tipler `frontend/users/types.ts`
- Router glue:
  - `frontend/users/routerAttach.ts` `#/users` için geçici stub (UI Part 3'te gelecek)
- i18n:
  - Anahtarlar `frontend/i18n/index.ts` dosyasına eklendi (de/en/tr)

## Benutzerverwaltung – UI (Part 3/4)
- `#/users` rotası gerçek kullanıcı yönetimi panelini gösterir
  - Sol: arama ile kullanıcı listesi
  - Sağ: detay (e-posta, ID, roller, MFA, oturumlar)
- Eylemler:
  - Rol ata (denetim rolleri için claims formu)
  - Oturumları sıfırla
  - Kullanıcı oluştur
- Kullanır:
  - `frontend/users/users.api.ts`, `frontend/users/roles.api.ts`
  - i18n anahtarları `frontend/i18n/index.ts`

## Benutzerverwaltung – Final (Part 4/4)
Yeni backend uçları:
- `GET    /api/users/:id/permissions` → çözümlenmiş izin anahtarları
- `DELETE /api/users/:id/roles/:role` → kullanıcıdan rol kaldırır

UI geliştirmeleri:
- Rol kaldırma (`×` rozet üzerinde)
- “Permissions” paneli (sunucu üzerinden çözümlenmiş)
- Sayfalama kontrolleri (◀ ▶), yükleniyor durumları ve toast mesajları

Notlar:
- Sunucu `permissionTemplates.ts` içindeki `getTemplate` / `resolveEffectivePermissions` fonksiyonlarını kullanır.
- Prisma üzerinden rol kaldırma, Prisma başarısız olursa bellek içi yedek uygulanır.

## Permissions Matrix
- Route: `#/permissions`
- Backend uçları:
  - `GET  /permissions/templates`
  - `GET  /permissions/roles/:role/effective`
  - (Dev only) `POST /permissions/templates/:role` → runtime günceller, kalıcı olması için seed dosyasını elle güncelleyin
- UI özellikleri:
  - İzin ve rol filtreleme, CSV dışa aktarma
  - Dev modunda seçili rolün allow/deny değerlerini inline düzenleme ve POST ile kaydetme
- Not: Production ortamında düzenleme devre dışı tutulmalı; şablonlar code review + seed güncellemeleriyle yönetilmeli.

## MP-17 (Part 1/4): Core Task & Notification
- Models: Task, TaskRun, Notification
- Notifier: email (nodemailer via `identity/src/mail.ts`), telegram (env), in-app (DB)
- Scheduler: in-process cron (`TASK_TICK_CRON`)
- After schema changes:
  ```bash
  npm run db:gen
  npm run db:migrate
  ```

## MP-17 (Part 2/4): REST APIs
**Tasks**
- `GET    /tasks`
- `POST   /tasks`            { name, cron, channels{}, payload{} }
- `PUT    /tasks/:id`
- `DELETE /tasks/:id`
- `POST   /tasks/:id/run`    → anlık tetikleme

**Notifications**
- `GET    /notifications?userId=&tenantId=`
- `POST   /notifications/:id/read`

Tüm uçlar `authGuard` arkasına mount edilir ve hata mesajları Türkçe döner.

## MP-17 (Part 2.5): Stabilization Patch
- **TSX**: tüm scriptler `npx tsx` kullanır; global kurulum gerekmez.
- **Hata Yönetimi**: `errorMiddleware` sayesinde JSON cevap formatı `{ ok: false, error, code? }`.
- **Smoke Test**
  ```bash
  npm run db:gen && npm run db:migrate
  npm run tasks:smoke
  npm run dev
  # ardından POST /tasks/<TASK_ID>/run (ya da cron */5 beklenebilir)
  ```

## MP-17 (Part 2.6): Hardening
- **Cron doğrulama**: geçersiz cron ifadeleri 400 "Geçersiz cron ifadesi" döner.
- **Scheduler bayrağı**: `DISABLE_SCHEDULER=true` → arka plan tetikleyici devre dışı (CI/test).
- **Health**: `GET /health` → `{ ok, service, version, now }`.
- **Okunmamış bildirim sayısı**: `GET /notifications/unread/count?userId=&tenantId=`.

## MP-17 (Part 3/4): SPA UI
- `#/tasks`: görev listesi, arama, oluşturma, düzenleme, silme, manuel tetikleme. JSON alanları doğrudan düzenlenebilir.
- `#/notifications`: bildirimleri listeler, okundu işaretleme aksiyonu.
- Tüm metinler i18n sözlüğüne eklendi (de/en/tr).
- Bildirimler toast bileşeni ile gösterilir (fallback: alert).

## MP-17 (Part 3.6): Nav Entegrasyonu
- Yeni header oluşturulmaz; mevcut container'lardan ilk eşleşene kompakt nav + dil seçici enjekte edilir.
- Seçiciler `frontend/ui/layout.config.ts` dosyasında tanımlı.
- Okunmamış bildirim sayısı bir badge placeholder'ına (varsa) yazılır; yoksa link metnine eklenir.
- İdempotent çalışma için `data-tp-nav-integrated="1"` guard'ı kullanılır.

## Hotfix Pack A
- **Notifications**
  - `GET  /notifications/unread/count?userId=&tenantId=`
  - `POST /notifications/unread/mark-all` – body `{ userId?, tenantId? }`
- **Tasks**
  - Manuel tetikleme: geçersiz JSON için `400` döner (`"<alan> alanı geçerli JSON değil"`).
- **Dil ipucu**
  - `langHint` middleware `Accept-Language` başlığından `req.localeHint` atar (davranış değişimi yok).
- **UI**
  - Bildirim rozeti her 60 saniyede otomatik yenilenir.

## Production Checklist (Phase 0)
- [ ] Set **JWT_SECRET**, **EXPORT_SIGN_SECRET**, **DEFAULT_NOTIFY_EMAIL** via secrets manager (do not commit).
- [ ] Ensure **DEV_BYPASS_AUTH=false** before any production/staging deploy.
- [ ] Configure **DEV_CORS_ORIGINS** with explicit domains (e.g., `https://admin.taxipartner.at`).
- [ ] `npm run db:migrate` then run smoke tests: `npm run tasks:smoke`.
- [ ] Verify `/health` responds with `{ ok:true }`.
- [ ] Confirm **no** `dist/`, `release-pack/`, or `*.db` files are tracked by git.
- [ ] Create release from clean CI artefacts (not local build outputs).

### Identity integration tests (Phase 1)
```bash
export JWT_SECRET=test-secret EXPORT_SIGN_SECRET=test-export DEV_BYPASS_AUTH=false DISABLE_SCHEDULER=true
node --test identity/tests/**/*.test.ts
```

## MP-18 Tenant & Gesellschaft Management
- Models: Tenant, TenantUser, OU, Company, CompanyOfficer, Shareholder, CompanyDocument
- APIs:
  - /tenants (list, create, assign user)
  - /ous (list/create by tenant)
  - /companies (list/create/update/delete, officers, shareholders, documents)
- Permissions: tp.tenant.*, tp.ou.*, tp.company.*
- SPA routes: #/tenants and #/companies (basic scaffold)
- After schema change:
  ```bash
  npm run db:gen
  npm run db:migrate
  ```

## MP-18B — Gesellschaft UI Completion
- Companies page: tabs for officers/shareholders/docs (list + add/remove).
- Tenants page: user assignment form.
- I18N: DE/EN/TR keys for officers/shareholders/docs.

### OU Backend Endpoints (MP-18 – Part 12)
- `PUT    /ous/:id` – body `{ name?, parentId? }`, requires `tp.ou.create`
- `DELETE /ous/:id` – requires `tp.ou.create`, silme öncesi alt OU kontrolü
> Tüm isteklerde `x-tenant-id` başlığını gönder (scopeGuard)

## MP-18 – Closure
To verify the module end-to-end:
```bash
# 1) Ensure schema & seed (if needed)
npm run db:ensure
npm run seed:mp18

# 2) One-shot verify (writes REPORTS/mp18_verify.md)
VERIFY_BASE=http://localhost:3000 VERIFY_TOKEN="<token>" npm run verify:mp18

# 3) Manual smoke (optional) – requires TENANT_ID
bash scripts/curl/mp18_smoke.sh <TENANT_ID>
```
Expected:
- `/health` → 200, `{ ok:true }`
- Companies: create → 201, detail includes relations; list returns items
- OUs: list → 200; create → 201; update/delete → 200

### RSP-1.1 – Stability helpers
- **Mount guard** (`frontend/ui/mountGuard.ts`): componentlerin aynı host elemana ikinci kez mount edilmesini engeller. Sayfa montajlarında `withMountGuard(host, "key", () => { ... })` kullanın.
- **Hash nav guard** (`frontend/bridge/routerBridge.ts`): aynı hash'e tekrar navigasyonu atlar; gerekirse `goHash(hash, true)` ile zorlanabilir.
- **Locales loader** (`frontend/i18n/loader.ts`): `locales/*.json` içeriklerini kod içindeki sözlükle birleştirir, mevcut anahtarları ezmez.
- **UI wiring check** (okuma amaçlı):
  ```bash
  node --loader tsx scripts/ui_wiring_check.mjs
  # rapor: REPORTS/ui_wiring_check.md
  ```b1192d5 (chore: sync local project state)
