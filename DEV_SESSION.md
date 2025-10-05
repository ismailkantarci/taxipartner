# Geliştirme Oturumu (Sıralı Terminal Komutları)

Bu dosya, hangi terminallerin açık olması gerektiğini hızlıca hatırlatır. iCloud senkronu sayesinde herhangi bir makinede aynı adımları uygulayabiliriz. Başlamadan önce `node -v` çıktısının `v20.x.x` olduğundan emin ol (`nvm` yüklüyse tek sefer `nvm use 20`).

## Terminal 1 – Identity Backend (port 3000)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
cd identity
npm install                                     # bu makinede ilk kezse
npx prisma generate --schema ../prisma/schema.prisma
npx prisma migrate dev --schema ../prisma/schema.prisma   # migration zaten uygulandıysa atla
npm run db:seed                                           # veriyi sıfırlamak istemiyorsan atla
npm run dev
```
Çıktıda `TAXIPartner Identity dev sunucusu 0.0.0.0:3000` mesajını gördüğünde bu terminali açık tut.

## Terminal 2 – Yönetim Paneli (port 5173)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
npm install                                     # yalnızca bu makinede ilk kezse
npm run dev
```
Vite çıktısındaki `http://localhost:5173` bağlantısını tarayıcıda aç.

## Terminal 3 – Identity SPA (port 5174)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11/frontend
npm install                                     # yalnızca ilk kurulumda
npm run dev
```
Vite linki `http://localhost:5174` olarak gelir; giriş ekranı burada.

## Terminal 4 – Otomatik Release Watch (isteğe bağlı)
```bash
cd /Users/ismailkantarci/Desktop/IK-Administrativesuite-v1.2.11
npm run watch:auto-release
```
Çıkmak için `Ctrl+C`. Durum/kapatma: `npm run watch:auto-release:status`, `npm run watch:auto-release:stop`.

## Tarayıcı Adımları
1. `http://localhost:5174/#/auth/login` → kullanıcı: `admin@taxipartner.test`, şifre: `Admin!234`.
2. `http://localhost:5173/#/users` → backend’den veri geldiğini doğrula.

Oturum bittiğinde her terminalde `Ctrl+C` ile süreçleri durdurmayı unutma.
