# Monorepo Genel Notları

- Ana uygulama `src/` altında React tabanlı admin panel (taxipartner-admin suite) kodlarını barındırıyor. `App.tsx` → `layout/AdminLayout.tsx` üzerinden route yapılandırması `src/routes.tsx` dosyasında.
- Kimlik / RBAC arka planı ayrı `identity/` paketinde yönetiliyor (Node + Prisma). Dev ortamında `tp` alias'ı bu servisi 3000 portunda ayağa kaldırıyor.
- `frontend/` klasörü kimlik SPA’sının (login / invite akışları) bağımsız Vite projesi. Çalıştırmak için `npm --prefix frontend run dev` (5174).
- Modüler JS “micro-frontend” paketleri `modules/` altında; her modül kendi `module.manifest.json` dosyasına sahip. Üretim build’i sırasında bu içerik `dist/modules` altına paketleniyor.
- `apps/`, `backend/`, `ops/` gibi klasörler ek servisler ve araçlar içeriyor; ihtiyaç halinde ilgili klasörün README/notes dosyalarına bakılmalı.
- Docker/Nginx tabanlı prod build için `infra/` altına Dockerfile ve nginx.conf eklendi (bkz. `notlar/docker-rc-notes.md`).
- Geliştirme süreçlerinin özeti `terminal-notes.md` dosyasında; Codespaces’te açılışta önce bu dosyaya bakmak gerekiyor.
