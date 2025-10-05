# TAXIPartner Dev Runbook

Bu dosya, bilgisayarı yeniden başlattıktan sonra ya da farklı bir makinede projeyi açtığında hangi terminallerde hangi komutların çalıştırılacağını adım adım özetler. Aşağıdaki adımları kopyala-yapıştır mantığıyla takip edebilirsin.

## 0. Önkoşullar ve Çoklu Makine Notları
- iCloud masaüstü senkronizasyonu sayesinde tüm makineler aynı klasörü görüyor. Hangi adımda kaldığımızı bu dosyadan takip ediyoruz.
- **Node 20** kullanılmalı. `node -v` çıktısı `v20.x.x` değilse <https://nodejs.org/download/release/latest-v20.x/> sürümünü kur. `nvm` yüklüyse `nvm install 20 && nvm use 20`; değilse pkg kurulumu yeterli.
- Docker gerekmiyor; `identity/.env` içindeki `DATABASE_URL="file:./dev.db"` ile SQLite kullanıyoruz.
- `identity/.env` içinde `DEV_BYPASS_AUTH=true` kaldığı sürece yerel login otomatik (seed kullanıcı: `admin@taxipartner.test`).

## 1. İlk kurulum (her makinede yalnızca bir kez)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11

# Identity backend
cd identity
npm install
npx prisma generate --schema ../prisma/schema.prisma
npx prisma migrate dev --schema ../prisma/schema.prisma   # migration zaten uygulandıysa atla
npm run db:seed                                           # yalnızca ilk sefer
cd ..

# Yönetim paneli
npm install

# Identity SPA
cd frontend
npm install
cd ..
```

## 2. Günlük çalışma rutini
Bilgisayarı her açtığında aşağıdaki terminalleri sırayla aç. `nvm` kuruluysa ilk komutlardan önce bir kez `nvm use 20` yeterli; diğer makinelerde doğrudan Node 20 ile devam edebilirsin.

### Terminal 1 – Identity Backend (port 3000)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
cd identity
npm run dev
```
Konsolda `TAXIPartner Identity dev sunucusu 0.0.0.0:3000 üzerinde hazır.` mesajını görene kadar bekle. Bu terminal açık kalmalı.

### Terminal 2 – Tailwind CSS watcher (dist/output.css)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
npx tailwindcss -i src/styles/tailwind.css -o dist/output.css --watch --postcss
```
Bu terminal Tailwind’i takip ederek `dist/output.css` dosyasını güncel tutar. Vite dev sunucusu bu dosyayı `index.html` üzerinden yüklediği için terminali açık bırak.

### Terminal 3 – Yönetim Paneli (port 5173)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
npm run dev
```
Konsolda Vite’in linkleri göründüğünde `http://localhost:5173` adresini aç.

### Terminal 4 – Identity SPA (port 5174)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11/frontend
npm run dev
```
Çıktıda `http://localhost:5174` linki gelir; giriş ekranı bu portta.

### Terminal 5 – Otomatik release/watch (isteğe bağlı)
Bu terminal, değişiklikleri izleyip patch versiyon artışı ve release log güncellemesini otomatik yapar. Gerektiğinde aç, işi bitince `Ctrl + C` ile kapat.

```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
npm run watch:auto-release
```

Durum kontrolü veya kapatma için:

```bash
npm run watch:auto-release:status
npm run watch:auto-release:stop
```

## 3. Oturum Açma ve Test
1. `http://localhost:5174/#/auth/login` adresini aç, `admin@taxipartner.test / Admin!234` ile giriş yap. Gerekirse TOTP kurulumunu tamamla.
2. `http://localhost:5173/#/users` adresine git ve approval listesini kontrol et. Token hem `localStorage` hem `tp_token` çerezi olarak ayarlanır.

## 4. Servisleri Durdurma
Her terminalde `Ctrl + C` basarak süreçleri durdurabilirsin.

## 5. Sık Karşılaşılan Sorunlar
- **`@prisma/client did not initialize yet`**: `npx prisma generate --schema ../prisma/schema.prisma` komutunu çalıştır.
- **`DATABASE_URL` bulunamadı**: `identity/.env` dosyasının var olduğundan emin ol (`DATABASE_URL="file:./dev.db"`).
- **Port çakışması**: Süreçleri `Ctrl + C` ile durdurup tekrar başlat.

Bu dosyayı düzenleyerek ilerideki değişiklikleri de buraya not edebilirsin.
