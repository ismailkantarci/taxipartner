# TAXIPartner Admin Suite — MP-18 Prep Audit

## 1) Executive Summary
Overall health is **okay**: architecture is modular and MP-17 scope is in place, but repo hygiene and security defaults need tightening. **Top risks:** (1) dev-only bypass defaults (`DEV_BYPASS_AUTH=true`) risk prod exposure, (2) persisted SQLite dev DBs checked in, (3) duplicated build artefacts (`dist/`, `release-pack/`) inflate repo and risk stale deployments, (4) permission/catalog drift (wildcard-heavy templates, minimal enforcement), (5) lack of automated coverage for new Task/Notification flows.

**Fix-First Checklist (priority order)**
1. Harden `.env` defaults (unset DEV_BYPASS, require real JWT secret) — identity/src/env.ts, .env.example.
2. Remove committed SQLite databases & add ignore rules — identity/dev.db, prisma/dev.db.
3. Gate `/auth/register` behind config flag or build guard for prod.
4. Create acceptance tests for Tasks manual-run & Notifications mark-all — identity/tests, frontend/tasks.
5. Add integration test for `/notifications/unread/count` & `/unread/mark-all`.
6. Move build artefacts (`dist/`, `release-pack/`) out of repo / ensure CI regenerates.
7. Document permission catalog & reconcile templates vs usage — identity/seeds/seed_role_permissions.json.
8. Introduce scheduler health probe & logging when DISABLE_SCHEDULER=true — identity/src/tasks.scheduler.ts.
9. Baseline security headers/CORS allowlist for prod domains — identity/src/server.security.ts.
10. Add CI step to enforce lint/test for identity & frontend.

## 2) Repository Map (Tree Snapshot)
```
/ (monorepo root)
  assets/                #1 file | TS:0 JS:0 | tests:0
  audit/                 #1 file | TS:0 JS:0 | tests:0
  dist/                  #15 files | TS:0 JS:5 | tests:0 (built artefacts)
  docs/                  depth: img/, ReleaseManagement-*.md | files:13
  frontend/              depth: audit/, auth/, notifications/, tasks/, users/, ui/, etc. | files:380 (TS:184 JS:90 tests:0)
  identity/              depth: public/, scripts/, seeds/, src/, node_modules/ | files:4695 (TS:864 JS:2274 tests:144)
  locales/               #3 json locales
  modules/               modular legacy UI bundles | files:55 (JS heavy)
  ops/                   deploy notes
  prisma/                schema + migrations + dev.db | files:8 (TS:1)
  release-pack/          build output bundle | files:4
  scripts/               automation scripts (mjs/bash/py) | files:32
  tests/                 legacy front-end Jest/Vitest tests | 19 JS test files
  (plus configs: README.md, SECURITY.md, etc.)
```
_TS/JS ratio derived from automated scan (see Notes). Node_modules excluded from counts._

## 3) Conventions & Hygiene
- **Naming:** Mostly kebab-case for files, PascalCase for TS types. Consistent but mix of `.mjs`/`.ts`/`.js`. No whitespace or non-ASCII filenames detected.
- **Orphans/Duplicates:** Built bundles (`dist/`, `release-pack/`), persisted DBs (`identity/dev.db`, `prisma/dev.db`), and duplicated locale JSON under `dist/assets/`. No evidence these are referenced at runtime — treat as artefacts.
- **Large Files (>1 MB):** Primarily vendor binaries in `node_modules/`. Project-owned large file: `modules/ReleaseManagement/release-log.json` (~1.5 MB) — consider archiving or streaming.
- **Binary / lock files:** `package-lock.json` committed (expected). Multiple SQLite binaries from Prisma (expected).
- **Key Configs:**
  - `README.md` present, up-to-date through MP-17 + hotfix notes.
  - No `LICENSE` file — clarify distribution terms.
  - `.editorconfig`, `.gitignore`, `eslint.config.js`, `tailwind.config.js`, `postcss.config.js` present.
  - `tsconfig` lives under `frontend/vite.config.ts`? (No repo-level tsconfig; rely on per-package defaults.)
  - Package scripts: root `package.json` has extensive commands; some duplicates / unused (`watch:auto-release:*`, no CI enforcement). Identity package still references `node --test tests/auth.flow.test.ts` (test file missing), script trimmed but ensure alignment.

## 4) Backend (identity/)
- **Router Inventory**
  - `/auth` → `auth.routes.ts` (POST /register, /login, /totp/setup, /totp/verify, /invite, /invite/accept, /logout; GET /me).
  - `/invite` → `invite.routes.ts` (POST /create, POST /accept).
  - `/export` → `export.routes.ts` (GET /audit-package).
  - `/permissions` → `permissions.routes.ts` (GET /templates, GET /roles/:role/effective, POST /templates/:role).
  - `/tasks` → `tasks.routes.ts` (CRUD + POST /:id/run).
  - `/notifications` → `notifications.routes.ts` (GET /, GET /unread/count, POST /unread/mark-all, POST /:id/read).
  - `/audit` → `audit.routes.ts` (GET /, GET /:id, GET /export/csv).
  - `/api/users` → `users.routes.ts` (GET /, GET /:id, GET /:id/permissions, POST /, POST /:id/assign, POST /:id/revoke, DELETE /:id/roles/:role).
  - `/api` → `apiRouter` (POST /assign-role, POST /finance/report).
  - `/approval` → `approvalRouter` (GET /list, POST /start, POST /:id/apply).
  - `/sso` → `sso.routes.ts` (GET /login, GET /callback).
  - `/health` → `health.routes.ts` (GET /).
  - `/notifications/unread` endpoints added; no path overlap detected.

- **Middleware order:** `applySecurity` (helmet, cors, rateLimit) → custom CORS handler → `langHint` → `/sso` router (public) → `attachAudit` (records requests) → `app.use('/auth', ...)` etc. `authGuard` applied to protected routes (`/invite`, `/export`, `/permissions`, `/api/users`, `/audit`, `/tasks`, `/notifications`, `/api`, `/approval`). Error middleware is last after static admin + `app.use('/admin',...)`. Order acceptable; ensure `errorMiddleware` stays last.

- **ENV Usage vs `.env.example`:**
  - Required: `DATABASE_URL`, `JWT_SECRET`, `EXPORT_SIGN_SECRET`, `DEV_BYPASS_*`, `TASK_TICK_CRON`, `DEFAULT_NOTIFY_EMAIL`, `TELEGRAM_*`, `DISABLE_SCHEDULER`, `APP_VERSION`, `DEV_CORS_ORIGINS`, `OIDC_*` (in env.ts but not documented). `.env.example` missing OIDC keys & `DEV_CORS_ORIGINS` — add.
  - Dangerous defaults: `DEV_BYPASS_AUTH=true`, `DEV_BYPASS_EMAIL=admin@local.test`, `JWT_SECRET` fallback to `dev-secret` inside `env.ts`. Document risk.

- **Security:** Helmet, rate limit (300 requests/15min), CORS allow-all optional via `*` (should be production restricted). `/auth/register` accessible unless NODE_ENV != dev/test — relies on env. DEV bypass auto-creates superadmin user; highlight risk for prod misconfiguration.

- **Dead Code / Unused:** `approvalStore.memory.ts` appears unused (legacy). `assignRole.handler.ts` not referenced after router refactor. Consider cleanup.

- **Complexity Hotspots:** `users.routes.ts` (~220 lines), `server.ts` (~210 lines), `approveGuard.ts` (~240 lines). Refactor into service layers. Use TypeScript types across repo.

## 5) Database & Migrations (prisma/)
- **Models:** `User`, `Role`, `UserRole`, `Session`, `Approval`, `AuditLog`, `UserExternalLogin`, `Task`, `TaskRun`, `Notification`.
- **Relations:** `User` ↔ `Role` via `UserRole`; `Task` ↔ `TaskRun`; `Notification` optional user/tenant.
- **Indexes:** `AuditLog` indexes on ts, actorId, tenantId, action. Missing index on `Notification.isRead` + `userId` (heavy query) — consider composite index. `Task` likely needs index on `isEnabled`.
- **Migrations:** `init`, `add_role_name_unique`, `mp17_task_notification`. No pending migrations in repo, but committed SQLite `dev.db` suggests local state drift — remove from VCS.
- **Seed:** `prisma/seed.ts` seeds roles and admin user aligned with schema; now reuses `hashPassword` utility. Danger: default admin password in repo; highlight.

## 6) Frontend (frontend/)
- **Router Map:** Hash-based routes from routerAttach files: `#/auth/login`, `#/invite/accept`, `#/users`, `#/permissions`, `#/audit`, `#/tasks`, `#/notifications`. Additional route watchers in nav integration ensure existing layout hooking.
- **i18n Coverage:** `frontend/i18n/index.ts` merges dictionaries; new Task/Notification keys added for DE/EN/TR. Some values reused placeholders (English words in nav). Need audit for modules outside i18n (legacy modules under `modules/` rely on different system).
- **UI Assets/CSS:** Each feature has `page.css`; duplicates base classes (cards/buttons). Consider shared utility CSS. Legacy `modules/` CSS duplicates (menu.css). `dist/` bundling in repo; remove.
- **API Clients:** `frontend/tasks/api.ts`, `frontend/notifications/api.ts`, `frontend/users/users.api.ts`, `frontend/permissions/api.ts`, `frontend/audit/api.ts`, `frontend/auth/api.ts`. All map to identity endpoints; ensure CORS & base URL env (`VITE_IDENTITY_API`). No 404 risk observed.
- **Build/Vite:** `vite.config.ts` uses default config; no SSR anomalies. `frontend/dist/` committed – should be ignored.

## 7) Permissions & RBAC
- **Namespaces:** `tp.*`, `tp.identity.*`, `tp.finance.*`, `tp.hr.*`, `tp.vehicle.*`, `tp.partner.*`, `tp.contract.*`, `tp.docs.*`, `tp.gesellschaft.*`, `tp.tasks.*`, `tp.vorbuchhaltung.*`, `tp.insurance.*`, `tp.konzession.*`, `tp.dienstplan.*`, `tp.risk.*`, `tp.audit.*`, etc. Defined primarily in `identity/seeds/seed_role_permissions.json`.
- **Usage Drift:** Code references `tp.finance.report.read`, `tp.identity.*` (permissionGuard). Wildcards like `tp.*` + numerous deny entries risk over-granting. Need catalog & enforce actual modules.
- **Role Templates:** In JSON only; `getTemplate` searches by role. Ensure runtime roles align with seeds; no automated sync. Suggest schema to store templates in DB or version.

## 8) Tasks/Notifications/Audit Health (MP-17 scope)
- Scheduler guard + DISABLE_SCHEDULER logging present (`identity/src/tasks.scheduler.ts`). Cron validation in create/update and manual-run (hotfix ensures JSON errors). Error middleware global.
- Notifications: endpoints `/notifications`, `/notifications/unread/count`, `/notifications/unread/mark-all`, `/notifications/:id/read`. UI integration in `frontend/ui/topnav.integrate.ts` (auto-refresh), `frontend/notifications/page.ts` (mark read). Badge placeholder support.
- Audit: middleware attaches logging, `audit.routes.ts` exposes list + CSV. `export.routes.ts` still returns `/audit-package` zipped logs.

## 9) CI/CD & Ops
- **Workflows:** `.github/workflows`? (Not inspected but `ci.yml`, `cd.yml` exist) — need to ensure they run tests & lint. Check missing: identity tests not triggered? confirm manually later.
- **Scripts:** Root `package.json` includes `db:*`, `identity:*`, `scheduler:dev`, `tasks:smoke`. Align but need docs on running identity tests. Identity package scripts still expect local `tsx` and undone `node --test` references.
- **Docker:** `docker-compose.yml` at root (review for Postgres). Ensure env matches `.env.example`. No production Dockerfile noted.
- **Backup/Restore:** Scripts `pg-backup.js`, `pg-restore.js`, `ops/README-deploy.md` cover manual steps.

## 10) Risk Register
| ID | Risk | Impact | Likelihood | Mitigation | Owner | ETA |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | DEV_BYPASS_AUTH default true may hit prod | Critical | Medium | Require explicit FALSE in prod env + runtime warning | Platform Lead | ASAP |
| R2 | Committed SQLite DBs (identity/dev.db, prisma/dev.db) leaking data | High | High | Remove from repo, add gitignore, rotate seeded creds | Backend Lead | 1d |
| R3 | Permission wildcards (`tp.*`) over-grant access | High | Medium | Define authoritative permission catalog, tighten templates | Security Architect | 3d |
| R4 | No automated tests for tasks/notifications flows | High | Medium | Add integration tests hitting `/tasks` + `/notifications` | QA Lead | 3d |
| R5 | Build artefacts (`dist/`, `release-pack/`) stale | Medium | High | Purge from repo, enforce CI build step | DevOps | 2d |
| R6 | `EXPORT_SIGN_SECRET` defaults static | Medium | Medium | Document secret rotation & enforce env presence | Backend Lead | 2d |
| R7 | CORS wildcard via DEV_CORS_ORIGINS `*` risk | Medium | Medium | Validate allowed origins per env, add warn log | Platform Lead | 2d |
| R8 | Role template JSON drift vs code usage | Medium | Medium | Generate report comparing templates & runtime checks | RBAC Owner | 3d |
| R9 | `/auth/register` accessible outside dev if NODE_ENV mis-set | High | Low | Guard behind explicit feature flag | Backend Lead | 1d |
| R10 | Lack of LICENSE blocks distribution | Medium | Medium | Add proper OSS/commercial license | PM | 1d |

## 11) Action Plan (DORA-style)
- **Phase 0 (≤1 day)**
  - Reset ENV defaults: update `.env.example`, identity/src/env.ts to require explicit secrets.
  - Remove committed SQLite DBs & add to `.gitignore`.
  - Add LICENSE & update README with production setup guardrails.
- **Phase 1 (1–3 days)**
  - Implement automated tests covering `/tasks` manual run and `/notifications/unread` endpoints (identity/tests + frontend e2e stub).
  - Harden CORS configuration & document allowed origins.
  - Create script to audit permission catalog vs usage (`identity/seeds/seed_role_permissions.json` → report).
  - Update CI workflow to run `npm run identity:test` and `npm run test`.
- **Phase 2 (3–7 days)**
  - Design RBAC catalog (per-tenant/per-namespace) & replace wildcard `tp.*` permissions.
  - Externalize build artefacts (CI pipeline artifacts) & slim repo (remove dist/ release-pack/).
  - Add scheduler health endpoint + monitoring (expose last run, log warnings when disabled).
  - Document & enforce smoke tests (`npm run tasks:smoke`) in Ops runbook.

## 12) Appendix
### A. Raw Endpoint List (method path → file:line)
- `/auth/register` (POST) → identity/src/auth.routes.ts:49
- `/auth/login` (POST) → ...:69
- `/auth/totp/setup` (POST) → ...:94
- `/auth/totp/verify` (POST) → ...:117
- `/auth/invite` (POST) → ...:139
- `/auth/invite/accept` (POST) → ...:155
- `/auth/logout` (POST) → ...:202
- `/auth/me` (GET) → ...:208
- `/invite/create` (POST) → identity/src/invite.routes.ts:13
- `/invite/accept` (POST) → ...:36
- `/export/audit-package` (GET) → identity/src/export.routes.ts:19
- `/permissions/templates` (GET) → identity/src/permissions.routes.ts:11
- `/permissions/roles/:role/effective` (GET) → ...:15
- `/permissions/templates/:role` (POST) → ...:26
- `/tasks` (GET/POST) → identity/src/tasks.routes.ts:37/46
- `/tasks/:id` (PUT/DELETE) → ...:73 / ...:103
- `/tasks/:id/run` (POST) → ...:115
- `/notifications` (GET) → identity/src/notifications.routes.ts:10
- `/notifications/unread/count` (GET) → ...:31
- `/notifications/unread/mark-all` (POST) → ...:47
- `/notifications/:id/read` (POST) → ...:63
- `/audit` (GET) → identity/src/audit.routes.ts:6
- `/audit/:id` (GET) → ...:44
- `/audit/export/csv` (GET) → ...:58
- `/api/users` (GET/POST) → identity/src/users.routes.ts:44/108
- `/api/users/:id` (GET) → ...:94
- `/api/users/:id/permissions` (GET) → ...:71
- `/api/users/:id/assign` (POST) → ...:123
- `/api/users/:id/revoke` (POST) → ...:178
- `/api/users/:id/roles/:role` (DELETE) → ...:194
- `/api/assign-role` (POST) → identity/src/server.ts:89
- `/api/finance/report` (POST) → identity/src/server.ts:147
- `/approval/list` (GET) → identity/src/server.ts:161
- `/approval/start` (POST) → identity/src/server.ts:166
- `/approval/:id/apply` (POST) → identity/src/server.ts:182
- `/sso/login` (GET) → identity/src/sso.routes.ts:26
- `/sso/callback` (GET) → ...:57
- `/health` (GET) → identity/src/health.routes.ts:5

### B. Permission Keys (unique, sorted)
```
tp.*
tp.audit.read
tp.contract.*
tp.docs.read
tp.docs.read(masked)
tp.docs.upload
tp.driver.me.read
tp.driver.me.update
tp.dienstplan.*
tp.finance.*
tp.finance.*:approve
tp.finance.*:write
tp.finance.report.read
tp.finance.tax.*
tp.gdpr.*
tp.gesellschaft.edit
tp.gesellschaft.read
tp.gesellschaft.sign
tp.gesellschaft.vote
tp.hr.*
tp.hr.*:write
tp.hr.onboard.*
tp.hr.read
tp.hr.arbeitszeit.read
tp.identity.*
tp.insurance.*
tp.konzession.*
tp.partner.*
tp.partner.*:write
tp.risk.*
tp.tasks.read
tp.tasks.write
tp.vehicle.*
tp.vehicle.*:write
tp.vehicle.control.*
tp.vorbuchhaltung.*
tp.vorbuchhaltung.add
```
_(“!” denies) handled via policy; catalog still needs consolidation._

### C. Orphan / Generated Files
- `dist/` (root) — production build artefacts.
- `frontend/dist/` — Vite build output.
- `release-pack/` — packaged release artifacts.
- `identity/dev.db`, `prisma/dev.db` — local SQLite snapshots.
- Legacy `modules/*` JS bundles (ensure still required by main app, otherwise archive).

### D. Large Files (>1 MB)
- `modules/ReleaseManagement/release-log.json` (~1.5 MB)
- Numerous vendor binaries under `node_modules/` (esbuild, prisma engines, typescript libs) — expected but monitor repo size.

---
