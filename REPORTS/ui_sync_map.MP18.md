# UI Sync Map (MP-18)

## companies/page.ts
- exports: `mountCompaniesPage(root: HTMLElement)` (L76)
- helpers
  - `loadList(selectId?: string | null)` (L153)
  - `showDetail(id: string)` (L215)
  - `renderDetail(company, tenantId)` (L240)
  - `wireOfficerSection(company, tenantId)` (L308)
  - `wireShareholderSection(company, tenantId)` (L360)
  - `wireDocumentSection(company, tenantId)` (L418)
  - `getDetailTemplate(company)` (L508)
  - common helpers `q`, `valueOf`, `emptyToNull`, `setBusy` (L657‑686)
- `localStorage.tp_tenantId`: read+prefill @L90‑94; write on change @L95‑101; also written on create @L131 and on every list refresh @L163
- i18n & helpers: `t` imported @L14 and used widely (labels, messages, options); `showError` & `requireFields` imported @L15 and applied in create (L124‑128), list/detail error paths (L158‑170, L217‑237) and mutations in sections (L331, L383, L444 etc.)
- async button disable: create uses `setBusy(createBtn, …)` @L132/147; save button @L259/273; delete button @L266/285; section add/remove buttons reuse `setBusy`
- empty-state literals:
  - list fetch error -> `<div class="empty">Listelenemedi</div>` @L209‑212
  - detail fetch error fallback uses localized string, but creation failure list still uses t('noRecords') etc.
  - document meta fallback literal `'metaJson yok'` @L643‑649

## ous/page.ts
- File **not present** in `frontend/` (no OU SPA implementation found). Nothing to map.

## tenants/page.ts
- exports: `mountTenantsPage(root: HTMLElement)` (L12)
- create handler (`createBtn.addEventListener`) @L38‑67 uses `t`, `requireFields`, `showError`, disables button during async
- assign handler (`assignBtn.addEventListener`) @L69‑112 similarly uses `t`, `requireFields`, `showError`, disables button during async
- placeholders/buttons already localized via `t('tenantsTitle')`, `t('tenantCodePlaceholder')`, `t('tenantNamePlaceholder')`, `t('assignAction')`, etc. (L15‑33)

## i18n/index.ts (relevant keys)
- **de** present: `legalName`, `legalForm`, `uid`, `regNo`, `officers`, `shareholders`, `docs`, `tenantIdRequired`, `legalNameRequired`, `companyCreateFailed`, `companyDeleteConfirm`, `companyDeleted`, `companyUpdateFailed`, `companyDeleteFailed`, `companyNotFound`, `companyDetailLoadFailed`, `noRecords`, `statusActive`, `statusPassive`, `tenantAssignSuccess`, `percentMustBeNumber`, `optional`, `userId`, `tenantCodeLabel`
  - missing: plain `tenantId`, `code`, generic `saved`/`created`/`deleted` keys (only scoped variants), localized “enterTenantId” still DE but present, `companySaved` (unused)
- **en** present: same set (`legalName`, `legalForm`, `uid`, `regNo`, `officers`, `shareholders`, `docs`, `tenantIdRequired`, `legalNameRequired`, `companyCreateFailed`, `companyDeleteConfirm`, `companyDeleted`, `companyUpdateFailed`, `companyDeleteFailed`, `companyNotFound`, `companyDetailLoadFailed`, `noRecords`, `statusActive`, `statusPassive`, `percentMustBeNumber`, `optional`, etc.)
  - missing: plain `code` key (only `tenantCodeLabel`), generic `saved/created/deleted` strings if needed
- **tr** present: localized counterparts for `legalName`, `legalForm`, `uid`, `regNo`, `officers`, `shareholders`, `docs`, `tenantIdRequired`, `legalNameRequired`, `companyCreateFailed`, `companyDeleteConfirm`, `companyDeleted`, `companyUpdateFailed`, `companyDeleteFailed`, `companyNotFound`, `companyDetailLoadFailed`, `noRecords`, `statusActive`, `statusPassive`, `percentMustBeNumber`, `optional`, etc.
  - missing: plain `tenantId`, `code`, generic `saved/created/deleted` keys

## Notes
- Companies module already manages tenant persistence and async button states; list view still has legacy Turkish literals (`Listelenemedi`, `metaJson yok`).
- OU SPA file absent; future patches must account for missing target or create new implementation before applying instructions.
- i18n dictionary lacks standalone `code`/`tenantId`/`saved` keys if future patches expect them; current UI uses scoped variants (`tenantCodeLabel`, `tenantCreated` etc.).
