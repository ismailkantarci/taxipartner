# Terminal Görev Akışı (Güncel: 2024-10-05)

## Günlük Başlangıç Adımları
Bilgisayarı açtıktan sonra terminalleri sırayla başlat. Her adımı kendi terminal penceresinde/sekmesinde çalıştır ve terminali açık bırak. Terminal açmadan önce şu kontrolleri yap:
- `node -v` → `v20.x` olmalı.
- `~/Desktop/IK-Administrativesuite-v1.2.11/identity/.env` dosyasında `JWT_SECRET`, `DEV_CORS_ORIGINS`, `DEV_BYPASS_AUTH`, `DEV_BYPASS_EMAIL` değerleri tanımlı olmalı.
- İlk çalışma sonrası `npm install` ve `npx prisma generate --schema prisma/schema.prisma` komutlarının sorunsuz tamamlandığından emin ol (bir kez yapılması yeterli, sorun çıktığında tekrar et).

### Terminal 1 – Identity Backend (port 3000)
```bash
cd ~/Desktop/IK-Administrativesuite-v1.2.11/identity
npm run dev
```
Önemli:
- Identity mutlaka `identity` klasörü içinde başlatılmalı. Root klasörden `npm run identity:dev` kullanma; `.env` okunmaz ve `JWT_SECRET must be provided` hatası alırsın.
- Çıktıda `Listening on 0.0.0.0:3000` benzeri mesaj görmelisin. `@prisma/client did not initialize` hata mesajı gelirse aşağıdaki “Hızlı Sorun Giderme” bölümünü uygula.

### Terminal 2 – Yönetim Paneli (port 5173)
```bash
cd ~/Desktop/IK-Administrativesuite-v1.2.11
npm run dev
```
Bu terminal Vite’in sağladığı Admin panelini çalıştırır.

### Terminal 3 – Identity SPA (port 5174)
```bash
cd ~/Desktop/IK-Administrativesuite-v1.2.11/frontend
npm run dev
```
Kimlik arayüzü bu porta düşer.

### Terminal 4 – Tailwind Watcher (opsiyonel ama önerilir)
```bash
cd ~/Desktop/IK-Administrativesuite-v1.2.11
npx tailwindcss -i src/styles/tailwind.css -o dist/output.css --watch --postcss
```
CSS değişikliklerinin otomatik güncellenmesi için açık tut.

## Prisma / Veritabanı Senkronizasyonu
Ağır schema değişikliği aldıysan ya da uzun süre çalışmadıysan aşağıdaki adımları uygula. Çoğu gün sadece ilk iki komut yeterlidir.
```bash
cd ~/Desktop/IK-Administrativesuite-v1.2.11/identity
npx prisma generate --schema ../prisma/schema.prisma
cd ..
npm run db:seed
```
Migrate komutlarını sadece yeni migration geldiğini biliyorsan çalıştır (`npm run db:ensure`).

## Tarayıcı Testi
1. `http://localhost:5174/#/auth/login` → `admin@taxipartner.test / Admin!234` ile giriş.
2. `http://localhost:5173/#/users` → Approval paneli ve `triggerApproval` akışını dene.
3. `http://localhost:5173/#/companies` → Companies modülünü kontrol et.

## Hızlı Sorun Giderme
- `@prisma/client did not initialize yet`: Terminal 1’i durdur, `cd identity`, `npx prisma generate --schema ../prisma/schema.prisma` çalıştır, ardından `npm run dev` ile tekrar başlat.
- `JWT_SECRET must be provided`: `identity/.env` dosyasını aç, `JWT_SECRET` değerinin dolu olduğundan emin ol. `.env.example` varsa oradaki değeri kopyala.
- `NS_ERROR_CONNECTION_REFUSED` (tarayıcı): Identity backend kapalı. Terminal 1’i kontrol et; gerekiyorsa yeniden başlat.
- `Origin not allowed` CORS uyarısı: `identity/.env` içindeki `DEV_CORS_ORIGINS` değerine kullandığın URL’leri ekle.

## Faydalı Notlar
- `DEV_BYPASS_AUTH=true` development’ta otomatik login sağlar; production’da `false` olmalı.
- Her terminali kapatırken `Ctrl + C` kullan. Arka planda çalışan örneği kapatmadan yeni bir tane başlatma.
- Identity kaynaklarında `import ... assert { type: 'json' }` kullanımları Node 20 sonrası kaldırılacağından, uygun zamanda `with { type: 'json' }` sözdizimine geçilmesi gerekiyor (not: 2025-10-09).
