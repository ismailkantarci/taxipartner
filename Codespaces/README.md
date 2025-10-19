# Codespaces Terminal Akışı

Codespaces ortamında günlük işe başlarken aşağıdaki iki betik yeterlidir. Her betik Bash üzerinden çalıştırılır.

## 1. Bootstrap (ilk açılış veya bağımlılık güncellemesi sonrası)
```bash
bash Codespaces/01_bootstrap.sh
```
- Node sürümü ve `identity/.env` kritik değişkenlerini kontrol eder.
- Root, `identity/` ve `frontend/` dizinlerinde `npm install` çalıştırır.
- `npx prisma generate --schema prisma/schema.prisma` ile client üretir.
- Docker erişilebiliyorsa `docker compose up -d` komutu ile Postgres’i ayağa kaldırır.

> `identity/.env` dosyası repo içinde izlenmez. Bu dosyayı oluşturup `JWT_SECRET`, `DEV_CORS_ORIGINS`, `DEV_BYPASS_AUTH`, `DEV_BYPASS_EMAIL` değerlerini set etmen gerekir.

## 2. Servisleri Başlat
```bash
bash Codespaces/10_start_all.sh
```
Bu komut aşağıdaki süreçleri tek terminal içinde paralel olarak başlatır:
- Identity backend (`identity/` → `npm run dev`)
- Admin paneli (`npm run dev`)
- Identity SPA (`frontend/` → `npm run dev`)
- Tailwind watcher (`tailwindcss -o dist/output.css --watch`)

Çıktılar aynı terminal sekmesinde karışık görünebilir. İstersen tek tek çalıştırmak için şu komutları ayrı sekmelerde kullan:

```bash
npm --prefix identity run dev
npm run dev
npm --prefix frontend run dev
npx tailwindcss -i src/styles/tailwind.css -o dist/output.css --watch --postcss
```

## Hızlı Notlar
- Bootstrap betiği günlük çalışmada gerekmez; bağımlılık değişikliği sonrası veya Codespace’i ilk açtığında çalıştır.
- Postgres konteynerini durdurmak için `docker compose down` komutunu kullanabilirsin.
- Tüm servisleri durdurmak için `Ctrl + C` yeterlidir; `npm-run-all` tüm alt süreçleri kapatır.
