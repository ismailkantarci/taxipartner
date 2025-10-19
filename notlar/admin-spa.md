# Admin SPA (src/) Notları

- Ana giriş: `src/main.tsx` → `App.tsx`. Layout `src/layout/AdminLayout.tsx`; header/notification/tenant switch gibi paylaşılan bileşenler burada.
- Route tanımı: `src/routes.tsx`. RBAC guard kontrolleri `src/lib/rbac/guard.tsx` ve `policy.ts` üzerinden gerçekleşiyor.
- Durum katmanı: React Query (`src/lib/query`), notifications store (`src/lib/notifications`), settings store (`src/lib/settings`). Yeni yazılan testler `src/lib/.../__tests__/` altında.
- i18n sistemi: `src/lib/i18n/index.ts` (bundle) + `src/lib/i18n/format.ts`. Quick language switch `AdminLayout` üzerinden `saveUserSettings` çağırıyor.
- Audit merkezi: `src/pages/AuditListPage.tsx` + `src/features/audit/api.ts`; CSV export helper `src/lib/export/exportCsv.ts`.
- Docker prod build’de bu SPA `npm run build` sonucunda `dist/` altına düşüyor ve Nginx ile servis ediliyor.
- Vitest yapılandırması `vitest.config.ts`; Playwright config `playwright.config.ts`. E2E senaryolar `tests/e2e/` altında, `npm run test:e2e` komutuyla.
