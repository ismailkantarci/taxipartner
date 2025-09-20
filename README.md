# taxipartner

## Scripts
- `npm i` – install deps
- `npm run dev` – vite dev server
- `npm run build` – vite build + tailwind css build
- `npm test` – vitest unit tests

## Architecture
- Entry: `modules/core.app/main.js`
- Router: `modules/core.router/` (hash router, guard + 404)
- Loader: `modules/core.moduleLoader/` (manifest + sanitize + dispose)
- State: `modules/core.state/` (theme/i18n fallback)
- UI: `modules/core.header/`, `modules/core.sidebar/`, feature modules under `modules/*`

## Security
- CSP in `index.html` is strict (no inline scripts/styles). `img-src` izinleri: `self`, data URIs ve `ui-avatars.com`.
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
- Unsaved changes: After edits/import/final/delete, a save banner is shown via the action menu. Navigating away (refresh/close) warns the user until JSON is saved (dev writes via `/api/release-log`, otherwise downloads the file). (feat(release-mgmt): i18n + UI polish, a11y, sticky compare, quick filters, unsaved banner, hotkeys, comfortable density\n\n- i18n: actions/menu/density/import/reset width/aria/empty state\n- UX: active sort arrows + aria-sort, popover focus return, radius + viewport clamp\n- Compare: sticky header + bottom action bar, A/B badges\n- Visuals: chip theme vars, dark-mode borders/opacity, spacing/typography tweaks\n- Mobile: table height tune, filter aria-controls/expanded\n- New: quick filter presets (Stable/Last 30d/Files), hotkeys modal, comfortable density\n- Fix: favicon data URI percent-encoding for build\n\nRefs: v1.3.392)
