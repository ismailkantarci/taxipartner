# TAXIPartner – MP18 Prep Remediation Plan

## 0) Executive Summary
The codebase is functionally sound after MP-17, yet key production safeguards remain “development-default”, with sensitive bypass flags and seeded secrets still active. Repo hygiene (checked-in SQLite DBs, build artefacts) inflates risk surface, while permissive RBAC wildcards and thin coverage for the new Tasks/Notifications engine leave gaps before MP-18’s tenant rollout. Quick wins include hardening env defaults, scrubbing artefacts, and adding targeted integration tests; more involved work will align permissions, CI gates, and database indexes with production expectations.

## 1) Top Fixes (Checklist)
1. Disable DEV_BYPASS + require explicit JWT/EXPORT secrets (`identity/src/env.ts`, `.env.example`).
2. Remove committed SQLite/`dist/` artefacts and ignore going forward (`identity/dev.db`, `prisma/dev.db`, `.gitignore`).
3. Introduce `/notifications` unread integration tests covering count + mark-all (identity/tests, frontend/notifications).
4. Add scheduler health + DISABLE_SCHEDULER guard logging (`identity/src/tasks.scheduler.ts`).
5. Tighten CORS allowlist to explicit domains & warn on wildcard (`identity/src/server.security.ts`).
6. Document + lint permission catalog, replacing `tp.*` with module-specific keys (`identity/seeds/seed_role_permissions.json`).
7. Extend CI workflow to run `npm run identity:test` & `npm test` ( `.github/workflows/ci.yml`).
8. Add Prisma indexes for `Notification(userId,isRead)` and `Task(isEnabled)` (`prisma/schema.prisma`).
9. Supply LICENSE and production guardrails in README (root `README.md`).
10. Gate `/auth/register` behind explicit feature flag (`identity/src/auth.routes.ts`).

## 2) Proposed Changes (Detailed)

### 2.1 ENV & Security Defaults
**What/Where:**
- Update `.env.example` to ship production-safe defaults (DEV_BYPASS disabled, placeholder secrets empty, add missing OIDC/CORS vars).
- Adjust `identity/src/env.ts` to throw when critical secrets absent; default `DEV_BYPASS_AUTH` to `false` and warn when enabled.
- Harden `identity/src/server.security.ts` by logging rejected origins and honoring explicit allowlists.

**Why:** Current defaults encourage running prod with dev bypass and weak secrets, violating principle of secure defaults.

**Example Diff (not applied):**
```diff
--- a/.env.example
+++ b/.env.example
@@
-DATABASE_URL="postgresql://tpuser:tppass@localhost:5432/taxipartner?schema=public"
-JWT_SECRET="replace-me"
-EXPORT_SIGN_SECRET="change-this-long-random"
-DEV_BYPASS_AUTH=true
-DEV_BYPASS_EMAIL=admin@local.test
+DATABASE_URL="postgresql://__USER__:__PASS__@localhost:5432/taxipartner?schema=public"
+JWT_SECRET=""
+EXPORT_SIGN_SECRET=""
+DEV_BYPASS_AUTH=false
+DEV_BYPASS_EMAIL=""
+DEV_CORS_ORIGINS=http://localhost:5173 http://localhost:5174
+OIDC_AUTHORITY=
+OIDC_CLIENT_ID=
+OIDC_CLIENT_SECRET=
+OIDC_REDIRECT_URI=
```
```diff
--- a/identity/src/env.ts
+++ b/identity/src/env.ts
@@
-export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
-export const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true';
-export const DEV_BYPASS_EMAIL = process.env.DEV_BYPASS_EMAIL || 'admin@taxipartner.test';
+export const JWT_SECRET = must('JWT_SECRET');
+export const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true';
+export const DEV_BYPASS_EMAIL = process.env.DEV_BYPASS_EMAIL || '';
+if (DEV_BYPASS_AUTH) console.warn('[auth] DEV_BYPASS_AUTH enabled; disable in prod');
+
+function must(key: string) {
+  const value = process.env[key];
+  if (!value) throw new Error(`${key} must be provided`);
+  return value;
+}
```

### 2.2 Repo Hygiene
**What/Where:**
- Update `.gitignore` to exclude `identity/dev.db`, `prisma/dev.db`, `dist/`, `release-pack/`, `frontend/dist/`.
- Remove tracked artefacts via git (one-time cleanup commit with `git rm`).
- Document reproducible build pipeline (CI generates artefacts, not committed).

**Why:** Versioning binaries/db snapshots risks accidental data leaks and merge churn.

**Safe Removal Plan:**
```
git rm --cached identity/dev.db prisma/dev.db dist/** release-pack/** frontend/dist/**
```
Add CI job to upload build outputs as artifacts if needed.

**Example Diff (.gitignore):**
```diff
@@
+/identity/dev.db
+/prisma/dev.db
+/dist/
+/frontend/dist/
+/release-pack/
```

### 2.3 Permissions & RBAC
**What/Where:**
- Establish `docs/permissions-catalog.md` referencing `identity/seeds/seed_role_permissions.json` as the source of truth.
- Replace wildcard allows (`tp.*`) with enumerated keys per module (finance, hr, etc.).
- Introduce lint script (read-only) to detect undefined permissions referenced in code vs seed file.

**Why:** Wildcards mask drift and complicate future tenant isolation.

**Audit Script Snippet (for documentation, not yet added):**
```ts
// scripts/audit-permissions.ts (proposed)
import glob from 'glob';
import fs from 'fs';
const seeds = JSON.parse(fs.readFileSync('identity/seeds/seed_role_permissions.json','utf8'));
const allowed = new Set(seeds.templates.flatMap((t:any)=>t.allow));
const files = glob.sync('identity/src/**/*.ts');
for(const file of files){
  const text = fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/tp\.[a-zA-Z0-9_.:-]+/g)){
    if(!allowed.has(match[0])) console.log(`Missing? ${match[0]} @ ${file}`);
  }
}
```

### 2.4 MP-17 Coverage (Tasks/Notifications)
**What/Where:**
- Add integration tests under `identity/tests/tasks.notifications.test.ts` hitting `/tasks`, `/tasks/:id/run`, `/notifications/unread/count`, `/notifications/unread/mark-all`.
- Frontend smoke test (Playwright/Vitest) verifying `#/tasks` JSON editing and nav badge update.
- Assert error messages remain Turkish (`"channels alanı geçerli JSON değil"`).

**Why:** Ensures hotfix endpoints stay stable and manual-run exceptions bubble correctly.

**Test Outline:**
1. Seed smoke task (`npm run tasks:smoke`).
2. POST `/tasks/:id/run` with invalid JSON payload → expect 400 message.
3. POST `/notifications/unread/mark-all` → count returns 0.
4. Frontend test: visit `#/notifications`, click “Mark Read”, expect toast + count drop.

### 2.5 CI/CD
**What/Where:**
- Update `.github/workflows/ci.yml` to add steps: `npm install`, `npm run identity:test`, `npm test`, `npm run lint` if available.
- Add `prod:guard` job ensuring `DEV_BYPASS_AUTH` false for production deploy pipeline.
- Remove reliance on committed dist by building during CI and uploading artifact.

**Proposed Step:**
```yaml
- name: Run identity tests
  run: npm run identity:test
- name: Run frontend unit tests
  run: npm test
- name: Ensure no dist artifacts committed
  run: |
    if git ls-files dist | grep .; then echo "dist/ must not be committed"; exit 1; fi
```

### 2.6 Database & Indexes
**What/Where:**
- Add Prisma indexes: `@@index([userId, isRead])` for Notification, `@@index([isEnabled])` for Task, `@@index([cron])` optional.
- New migration `20251001_add_notification_indexes` establishing indexes.

**Why:** Enhances performance for unread counts and task scheduler queries.

**Example Diff:**
```diff
 model Notification {
   id        String   @id @default(cuid())
   userId    String?
   tenantId  String?
   channel   String
   subject   String?
   body      String?
   metaJson  String?
   isRead    Boolean  @default(false)
   createdAt DateTime @default(now())
 
   @@index([userId])
   @@index([tenantId])
+  @@index([userId, isRead])
 }

 model Task {
   id          String   @id @default(cuid())
   name        String
   description String?
   cron        String
   isEnabled   Boolean  @default(true)
   channels    String
   payload     String?
   lastRunAt   DateTime?
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt
   runs        TaskRun[]
+
+  @@index([isEnabled])
 }
```

### 2.7 Docs & Licensing
**What/Where:**
- Add `LICENSE` (recommend Apache-2.0 or company-specific proprietary license; align with legal).
- Update README “Production Checklist” detailing: set real secrets, disable DEV_BYPASS, configure CORS, run migrations, run smoke tests.

**Why:** Legal clarity and operational guardrails for MP-18 tenants.

**README Snippet:**
```
## Production Checklist
- [ ] Set JWT_SECRET, EXPORT_SIGN_SECRET, DEFAULT_NOTIFY_EMAIL.
- [ ] Ensure DEV_BYPASS_AUTH=false before deployment.
- [ ] Configure DEV_CORS_ORIGINS with prod domains.
- [ ] Run `npm run db:migrate` and `npm run tasks:smoke`.
```

## 3) Risk → Mitigation Table
| Risk | Impact | Likelihood | Files | Mitigation | ETA |
|------|--------|------------|-------|------------|-----|
| DEV bypass active in prod | Critical | Medium | identity/src/env.ts, .env.example | Default to false, warn when enabled | Phase 0 |
| SQLite/dev artefacts leaked | High | High | identity/dev.db, prisma/dev.db, dist/, release-pack/ | Remove & ignore, rely on CI builds | Phase 0 |
| RBAC wildcards hide overexposure | High | Medium | identity/seeds/seed_role_permissions.json | Enumerate per-module permissions, add audit script | Phase 1 |
| Tasks/Notifications regressions untested | High | Medium | identity/tests/, frontend/tasks/notifications | Add integration tests & UI smoke | Phase 1 |
| CORS wildcard accidentally permits prod origins | Medium | Medium | identity/src/server.security.ts | Explicit allowlist + logging | Phase 1 |
| Missing Notification index slowing unread count | Medium | Medium | prisma/schema.prisma | Add composite index + migration | Phase 2 |
| `/auth/register` exposed | High | Low | identity/src/auth.routes.ts | Gate behind feature flag | Phase 1 |
| Absent LICENSE complicates distribution | Medium | Medium | (root) | Add LICENSE & update README | Phase 0 |
| Incomplete CI gating | Medium | Medium | .github/workflows/ci.yml | Add lint/test steps, artifact policy | Phase 1 |
| Permission catalog drift vs code | Medium | Medium | identity/seeds/..., docs/ | Maintain catalog doc & lint | Phase 2 |

## 4) Step-by-Step Execution Plan (Phases)
**Phase 0 (≤1 day)**
- Update `.env.example` & `identity/src/env.ts` with secure defaults.
- Add `.gitignore` entries; remove tracked SQLite & dist artefacts.
- Add LICENSE file and README production checklist section.

**Phase 1 (1–3 days)**
- Introduce integration tests for Tasks/Notifications (identity + frontend) and ensure error messages validated.
- Gate `/auth/register` with explicit config flag.
- Harden CORS handling and log wildcard usage in `server.security.ts`.
- Extend CI workflow to run tests and enforce “no dist” policy.
- Create permission catalog doc + lint script (report-only).

**Phase 2 (3–7 days)**
- Refine RBAC templates: replace wildcards, align denies, document usage.
- Add Prisma indexes & generate migration (`npm run db:migrate --name add_notification_indexes`).
- Implement scheduler health logging & optional `/health/tasks` endpoint.
- Remove repo build artefacts from history (git filter or repo cleanup) and configure CI artifact storage.

## 5) Appendix
- **File Paths:**
  - `.env.example`, `.gitignore`, `LICENSE`, `README.md`.
  - `identity/src/env.ts`, `identity/src/server.security.ts`, `identity/src/auth.routes.ts`, `identity/src/tasks.scheduler.ts`, `identity/src/notifications.routes.ts`.
  - `identity/seeds/seed_role_permissions.json`, `docs/permissions-catalog.md` (new).
  - `prisma/schema.prisma`, `prisma/migrations/**` (new migration).
  - `.github/workflows/ci.yml`.
  - `identity/tests/tasks.notifications.test.ts` (new), `frontend/tests/tasks-notifications.spec.ts` (new).

- **Sample Diffs:** Provided above for `.env.example`, `identity/src/env.ts`, `.gitignore`, `prisma/schema.prisma`.

- **Rollback Notes:**
  - ENV hardening: retain previous defaults in branch to restore if necessary.
  - Repo hygiene: removing artefacts is non-destructive; backups available via git history (note in release plan before pruning).
  - Permissions rewrite: implement in feature branches with thorough regression tests; maintain JSON snapshots for revert.
  - Prisma indexes: run `prisma migrate resolve --rolled-back` to revert migration if issues arise.
  - CI modifications: keep original workflow YAML copy for quick restore.
  - Tasks/Notifications tests: revert added files if pipelines fail, but prefer to fix underlying issues.
  - Scheduler logging: feature-flag via env (e.g., `TASK_VERBOSE_LOG=true`) to disable if noisy.

---
