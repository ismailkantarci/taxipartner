# Terminal Görev Akışı (Güncel: 2025-05-09)

## Codespaces Minimal Komutlar
Her Codespaces açılışında aşağıdaki komutları sırasıyla çalıştırman yeterli:
1. `cp .env.example .env`
2. `npm install`
3. `npm run dev`

### Tek Komut ile Tüm Servisler
- `npm run codespaces:start` tek terminalde Identity API (3000), Admin (5173), Identity SPA (5174) ve Tailwind watcher’ı paralel çalıştırır.
- Terminal kapanırsa aynı komutu tekrar çalıştırman yeterli; eksik servisi ayrı ayrı araman gerekmez.

Tarayıcıda `http://localhost:5173/#/` adresine giderek dashboard’u kontrol et. Paralel terminal sekmelerinde gerekirse şu komutları da aç:
- `npm run dev:vite` – yalnız Vite sunucusu (dev server)
- `npm run dev:css` – Tailwind watcher (`output.css`)
- `npm --prefix identity run dev` – Identity API (kodun beraberinde gerekirse)
- `npm --prefix frontend run dev` – Identity SPA (5174 portu)
- `npm test` – Vitest birim testleri
- `npm run verify` – Lint + typecheck + unit test kombinasyonu
- `npm run verify:rc` – Build, Lighthouse ve Playwright e2e (dist üzerinden)
- Not: Identity SPA kendi başına açıldığında ana URL boş (beyaz) görünür; login arayüzü için `#/auth/login` hash’ini kullan (`http://localhost:5174/#/auth/login`).
- Kimlik doğrulama veya invite kabul test edeceksen önce `npm --prefix identity run dev` komutunu aç; terminalde `Listening on 0.0.0.0:3000` logunu görmeden SPA’dan login denemesi 502/Fetch hatası verir.

### Docker RC Akışı
- Prod benzeri doğrulama yapacaksan `notlar/docker-rc-notes.md` dosyasındaki adımları takip et.
- Kısa özet: `tp rc-build`, `tp docker-up`, `tp lighthouse`. İş bitince `tp docker-stop`.

Bu listeden farklı bir akışa ihtiyaç duyarsan alttaki ayrıntılı bölümleri kontrol et.

### Çalışma Kuralı
- VS Code içinde bu dosyanın (`terminal-notes.md`) ilk bölümünü ayrı sekmede açık tut; komut sırası değişirse hemen burada güncelle.
- Yeni ihtiyaç/servis çıktığında önce bu listeyi güncelle, ardından terminalleri yeni akışa göre başlat.

## Günlük Başlangıç Adımları
Bilgisayarı açtıktan sonra terminalleri sırayla başlat. Her adımı kendi terminal penceresinde/sekmesinde çalıştır ve terminali açık bırak. Terminal açmadan önce şu kontrolleri yap:
- `node -v` → `v20.x` olmalı.
- `~/Desktop/IK-Administrativesuite-v1.2.11/identity/.env` dosyasında `JWT_SECRET`, `DEV_CORS_ORIGINS`, `DEV_BYPASS_AUTH`, `DEV_BYPASS_EMAIL` değerleri tanımlı olmalı.
- İlk çalışma sonrası `npm install` ve `npx prisma generate --schema prisma/schema.prisma` komutlarının sorunsuz tamamlandığından emin ol (bir kez yapılması yeterli, sorun çıktığında tekrar et).

### Codespaces Kısayolu
- İlk açılışta: `bash Codespaces/01_bootstrap.sh`
- Servisleri paralel başlatmak için: `bash Codespaces/10_start_all.sh` (tek terminalde tüm süreçler açılır)
- İstersen mevcut `Terminal/*.command` betiklerini Codespaces içinde de (ör. `bash Terminal/10_start_identity.command`) kullanabilirsin.

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

## Codespaces Hızlı Akış (2025-10-11)
Development Codespaces ortamı için tipik süreç:

1. Artık süreç yoksa eski Node örneklerini kapat:
   ```bash
   pkill -f "src/server.ts"
   pkill -f "node_modules/.bin/vite"
   ```
2. Role/kullanıcı seed’i:
   ```bash
   npm --prefix identity run db:seed
   ```
3. Identity API (port 3000, `--host` gerekmiyor):
   ```bash
   npm --prefix identity run dev
   ```
4. Admin Vite (port 5173):
   ```bash
   npm run dev:vite -- --host 0.0.0.0 --port 5173
   ```
5. Tailwind watcher:
   ```bash
   npm run dev:css
   ```
6. Identity SPA (port 5174):
   ```bash
   npm --prefix frontend run dev -- --host 0.0.0.0 --port 5174
   ```
> Not: `.env` ve `.env.development.local` dosyalarında `VITE_IDENTITY_API` Codespaces tünel URL’sine işaret etmeli (`https://<codespace>-3000.app.github.dev`).

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

## Build / Test Notları (2025-10-12)
- Identity SPA prod derlemesi için: `npm --prefix frontend run build`. (Vite `build.target` = `es2022`; top-level await destekliyor.)
- Hızlı backend kontrolleri: `npm --prefix identity run test` (yalnızca role/permission unit testleri).
- Tam auth flow testi gerekiyorsa `npm --prefix identity run test:auth`. (İlk kez çalıştırmadan önce bir kere `cd identity && DATABASE_URL="file:./auth-test.db" npx prisma migrate deploy --schema ../prisma/schema.prisma` komutunu çalıştırmak yeterli.)
- Backend TS derlemesi: `npm --prefix identity run build` (tsc).

## Tip Temizliği Notu (2025-10-18)
- Legacy `frontend` modüllerindeki (auth, tasks, notifications, tenants, users) `any/unknown` kullanımları daraltıldı; ortak header yardımcıları `frontend/api/http.ts` altında toplandı.
- DOM seçimleri `frontend/ui/dom.ts` üzerinden null-safe hale getirildi, localStorage anahtarları `frontend/ui/storageKeys.ts` dosyasında sabitlendi.
- `modules/*` altındaki legacy JS modülleri için `.d.ts` bildirimleri (AppState, ModuleLoader, Companies, Settings, phone-input, library tokens) eklendi; TS tarafı artık modül API'lerini tanıyor.
- `src/data` IAM seed kümeleri `iamTypes.ts` ile tiplenip `src/data/index.ts` üzerinden paylaşıldı; Users/Permissions/Roles/Sessions/Audit sayfaları bu tipleri kullanıyor.
- Identity `GET /tenants` uç noktası sıralama/sayfalama parametrelerini (sort/order/page/pageSize) ve `total` meta bilgisini destekliyor; legacy Tenants SPA uyumlu.
- Tip kontrolü + lint + test seti için `npm run verify` çalıştırıldı ve yeşil sonuçlandı.

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
