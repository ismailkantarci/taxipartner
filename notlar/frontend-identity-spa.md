# Frontend (Identity SPA) Notları

- Vite tabanlı single-page app (login/invite). Giriş dosyası `frontend/main.ts` ve router `frontend/main.router.ts`.
- Paketler: `frontend/auth`, `frontend/notifications`, `frontend/permissions` vb. domain klasörleri içeriyor.
- Dev ortamda `npm --prefix frontend run dev` (5174). Prod build çıktısı `frontend/dist/`.
- Ortak i18n yardımcıları `frontend/i18n/` altında; login ekranı `frontend/auth/loginPage.ts`.
- Tailwind yapılandırması `frontend/tailwind.config.js`; styling için `frontend/ui/` bileşenleri kullanılmakta.
- Bu proje admin SPA’ya gömülü değil; reverse proxy ile `/approval` vb. endpoint’leri API’ye yönlendiren `frontend/vite.config.ts` bulunuyor.
