# Lighthouse Otomasyon Durumu
- `tp lighthouse` komutu 8080 portunu varsayıyor. Docker konteyneri çalışmıyorsa önce `tp docker-up` çalıştırılmalı.
- Raporu kaydetmek için `TP_LIGHTHOUSE_REPORT=1 tp lighthouse` veya `npm run verify:rc` (dist üzerinden) komutlarını kullan.
- CI senaryosu: `npm run verify:rc` script’i build + Lighthouse + Playwright e2e aşamalarını tek komutta çalıştırır; `scripts/ci/rc-verify.mjs` üzerinden GitHub Actions’a bağlanabilir.
