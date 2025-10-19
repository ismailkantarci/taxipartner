# Identity Servisi Notları

- Detaylı README: `identity/README.md` (ilk kurulum, iş kuralları).
- Node 18+ uyumlu; dev ortamda `npm --prefix identity run dev` ile 3000 portunda API açılıyor.
- Prisma şeması: `prisma/schema.prisma` (monorepo kökünde). `tp` komutu çalışırken otomatik `prisma migrate deploy` tetikliyor.
- Seed verileri `identity/seeds/` klasöründe: rol / permission şablonları ve uyumsuzluk listeleri.
- Testler `identity/tests/` altında `node:test` + `tsx` ile çalışıyor (`npm --prefix identity run test`).
- TS yapılandırmaları: `identity/tsconfig.json` (dev), `identity/tsconfig.typecheck.json` (lint/typecheck). ESLint tipi denetimler kök config’ten okunuyor.
- `.env` zorunlu: JWT_SECRET, DEV_CORS_ORIGINS, DEV_BYPASS_AUTH, DEV_BYPASS_EMAIL. `Codespaces/10_start_all.sh` kontrol ediyor, eksikse servis başlamıyor.
