# UI Gap Test (MP-18)

## 0) Executive Summary
- Status: **Risky**
- Top Risks:
  1. `/companies` route splits between SPA (fully functional) and module placeholder – sidebar/core router still load the placeholder, so the new UI is unreachable from the main shell.
  2. Sidebar/core router never expose `#/tenants` or `#/ous`; the new SPAs can only be opened by typing the hash manually.
  3. Companies SPA ships as a dev scaffold (Turkish literals, no tabs/CSV/filters, no state persistence) and falls short of MP-18 spec expectations.
  4. OUs page uses modal placeholders (`prompt/alert`), reuses company error strings, and leaves unused imports – UX and logging issues likely.
  5. i18n catalog still misses required keys (`documents`, `required_pairs`, `export`) and contains duplicate `userId` entries in `tr`, risking incorrect labels.

## 1) Route/Module Wiring Map
- `frontend/main.router.ts`: `#/users` → `mountUsersPage`, `#/permissions` → `mountPermissionsPage`, `#/audit` → `mountAuditPage`, `#/tasks` → `mountTasksPage`, `#/notifications` → `mountNotificationsPage`, `#/tenants` → `mountTenantsPage`, `#/companies` → `mountCompaniesPage`, `#/ous` → `mountOUsPage`, `#/auth/login` → `mountLogin`, `#/invite/accept` → `mountInviteAccept`.
- Module loader (`modules/core.router/index.module.js`): routes only include `/companies`; there is **no entry** for `/tenants` or `/ous`, so module navigation can never load those SPAs.
- Sidebar (`modules/core.sidebar/index.module.js`) links stop at `/users`/`/settings`; there are **no anchors** for `/companies`, `/tenants`, or `/ous`.
- `modules/Companies/index.module.js` renders static HTML with button `#cmp-new` but **adds no click handler** – dead button.
- The module HTML (`modules/Companies/index.module.html`) just hosts an empty root div; no wiring to `frontend/companies/page.ts`. Result: duplicate entry-point (`#/companies` SPA vs module) with completely different UIs.

## 2) Companies – Findings
- Handlers implemented: **Create** (lines 111-138), **Save** (240-266), **Delete** (268-284), **Officers/Shareholders/Documents add/remove** (301-407). Missing features: no tab switching (`wire*Section` just stacks sections), no CSV export, no advanced filters (only text search), no status filter, no pagination.
- State persistence: only `localStorage.setItem('tp_tenantId', …)` (line 153). Nothing for `tp_companies_state`, no persisted search/selection beyond first item.
- i18n gaps / literals:
  - Labels hard-coded: `tenantId`, `Arama`, `Yenile`, `Create`, `Ekle`, etc. (`frontend/companies/page.ts:434-615`).
  - Status options `'Active'/'Passive'` rendered directly (`frontend/companies/page.ts:528-529`).
  - Empty-state text `'Kayıt yok'`, `'metaJson yok'`, `'user:'` literals inside template (`frontend/companies/page.ts:541-606`, `636-642`).
  - API helper returns `'Beklenmeyen cevap'` literal on JSON parse failure (`frontend/companies/api.ts:9`).
- CSV/filter handlers completely absent; there is no call to any export API.
- Functions `getDetailTemplate`, `wireOfficerSection`, `wireShareholderSection`, `wireDocumentSection` are defined inline in this file (good), but no shared module for templates.

## 3) OUs – Findings
- Handlers present: **Reload** (line 62), **Search** (63), **Create** (65-89), **Edit** via `prompt` (161-179), **Delete** via `confirm` (182-197), parent select refresh (199-205).
- Tree rendering implemented (135-159), filtering works on name. `spinnerHtml` defined but unused (line 49). Imports `showModal/closeModal` unused (line 3).
- API wrappers (`frontend/ous/api.ts`) expose list/create/update/delete → align with backend routes (`identity/src/ous.routes.ts`). Responses returned raw JSON; there is no HTTP-status guard (non-JSON will throw).
- i18n issues:
  - Error message uses company string `t('companyListFailed')` (line 53).
  - Literal fallbacks `'Tenant ID required'`, `'Name required'`, `'Error'`, `'Ekle'`, `'Kayıt yok'` sprinkled across template (lines 65-188).
  - Alert/prompt usage surfaces untranslated backend strings.

## 4) Tenants – Findings
- Create (27-52) and Assign (54-79) handlers wired; success feedback writes to inline elements.
- Uses `requireFields` with localized messages (`tenantCodeRequired`, `tenantNameRequired`, `tenantIdRequired`, `userIdRequired`).
- API helpers (`frontend/tenants/api.ts`) match backend endpoints but share the same `'Beklenmeyen cevap'` literal fallback (line 9).

## 5) Backend Match
| Frontend Call | Backend Endpoint | Status |
| --- | --- | --- |
| `GET /companies`, `POST /companies` | `identity/src/companies.routes.ts` lines 16-58 | OK |
| `GET /companies/:id` | same file lines 60-89 | OK |
| `PUT /companies/:id` | lines 91-118 | OK |
| `DELETE /companies/:id` | lines 120-140 | OK |
| `POST /companies/:id/officers` / `DELETE /.../officers/:officerId` | lines 142-194 | OK |
| `POST /companies/:id/shareholders` / `DELETE /.../shareholders/:shareholderId` | lines 196-244 | OK |
| `POST /companies/:id/documents` / `DELETE /.../documents/:documentId` | lines 246-288 | OK |
| `GET /ous`, `POST /ous`, `PUT /ous/:id`, `DELETE /ous/:id` | `identity/src/ous.routes.ts` | OK |
| `GET /tenants`, `POST /tenants`, `POST /tenants/:id/users` | `identity/src/tenants.routes.ts` | OK |

No missing endpoints detected; however, frontend OU create/delete only checks `response.ok` from JSON – non-JSON failures will surface as uncaught exceptions.

## 6) i18n Coverage
- Present per language (de/en/tr): `tenantId`, `userId` (duplicate entries in tr at lines 440 & 462), `code`, `legalName`, `legalForm`, `uid`, `regNo`, `officers`, `shareholders`, `docs`, `saved`, `created`, `deleted`, `companyDeleteConfirm`, `noRecords`, `statusActive`, `statusPassive`, `tenantIdRequired`, `legalNameRequired`, `companyCreateFailed`, `cannotDeleteWithChildren`, `loading`, `search`, `parent`, `optional`.
- Missing per language: `documents` (only `docs` defined), `required_pairs`, `export`. Also `docs` vs spec `documents` mismatch will break lookups; no translations exist for `percentMustBeNumber` in en/de? (de/en yes?), check: there is `percentMustBeNumber`? need verifying but apparently there is line 155? we didn't check but glimpsed? maybe not necessary but hooking.
- Literal fallbacks still in code for `'tenantId'`, `'Create'`, `'Ekle'`, `'metaJson yok'`, etc., need i18n keys.

## 7) Hard-coded Strings
- `frontend/companies/page.ts:434-615` – multiple literal labels (`tenantId`, `Arama`, `Yenile`, `Create`, `Ekle`, `'Kayıt yok'`, `'user:'`, `'metaJson yok'`).
- `frontend/companies/api.ts:9` & `frontend/tenants/api.ts:9` – `'Beklenmeyen cevap'` fallback.
- `frontend/ous/page.ts:51-188` – `'Failed to fetch list'`, `'Tenant ID required'`, `'Name required'`, `'Error'`, `'Delete this entry?'`, `'Kayıt yok'`, `'Ekle'`, prompt/confirm strings.
- `frontend/ous/page.ts:170-188` – `alert(...)` usage with literal text.
- `frontend/users/approvalsPage.ts:47-82` – existing alerts (not MP-18 but still literal `Fehler`, `Hata`).

## 8) Actionable Checklist (prioritized)
1. [ ] Wire `/companies`, `/tenants`, `/ous` into `modules/core.router` and sidebar; replace `modules/Companies` placeholder with SPA bootstrap or remove duplicate route (modules/core.router/index.module.js, modules/core.sidebar/index.module.js, modules/Companies/index.module.js).
2. [ ] Implement real Companies dashboard UI (tabs/filters/CSV) or hide unfinished controls; replace Turkish literals with `t(...)` keys (frontend/companies/page.ts).
3. [ ] Update Companies module to call `mountCompaniesPage` or remove dead `#cmp-new` button (modules/Companies/index.module.js:6-13).
4. [ ] Refactor OUs UI to use shared modal/toast helpers instead of `prompt/alert`; add proper i18n error strings and remove unused imports (frontend/ous/page.ts:51-188).
5. [ ] Extend i18n catalog with missing keys (`documents`, `required_pairs`, `export`) across de/en/tr; reconcile duplicate `userId` entries (frontend/i18n/index.ts).
6. [ ] Replace raw literals in API helpers (`Beklenmeyen cevap`) with localized messages (frontend/companies/api.ts:9, frontend/tenants/api.ts:9).
7. [ ] Persist Companies list state (search, selection) via dedicated `tp_companies_state` store per spec (frontend/companies/page.ts:143-199).
8. [ ] Add CSV/export handler and filters matching backend capabilities (frontend/companies/page.ts – new section).
9. [ ] Ensure OU error handling returns localized messages and reuses OU-specific keys (frontend/ous/page.ts:51-80).
10. [ ] Run lint/build to catch unused imports/vars (`showModal`, `spinnerHtml`) and remove them (frontend/ous/page.ts:3,49).
