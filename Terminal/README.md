# Terminal Kısayolları

Dosyalar sıralı olarak çalıştırılacak şekilde numaralandırıldı. Her `.command` dosyasını çift tıkladığında yeni bir Terminal penceresi açılır ve komutlar otomatik çalışır.

## Çalıştırma Sırası
1. **01_env_check.command** – Node sürümü ve `identity/.env` kontrolleri.
2. **02_install_dependencies.command** – Root ve `identity` klasörlerinde `npm install` çalıştırır.
3. **03_prisma_prepare.command** – `npx prisma generate` ve isteğe bağlı seed/migration; senkron sonrası `identity/dev.db` kopyalanır.
4. **05_export_db.command** – `DATABASE_URL` ortam değişkenini bu oturum için ayarlar ve kabuğu açık bırakır.
5. **10_start_identity.command** – Identity API (`http://localhost:3000`).
6. **20_start_admin.command** – Admin paneli (`http://localhost:5173`).
7. **30_start_identity_spa.command** – Identity SPA (`http://localhost:5174`).
8. **40_start_tailwind.command** – Tailwind watcher (isteğe bağlı).

Her başlangıç betiği ilgili portu kontrol eder. Port meşgulse eski Node süreçlerini otomatik sonlandırır; yine de port boşalmazsa ekranda hangi PID'in sorun çıkardığı yazacak, o süreci kapatman yeterli.

## İlk Kurulum
```bash
cd "/Users/ismailkantarci/Documents/TAXIPartner Admin Suite"
chmod +x Terminal/*.command
```
Bu komutu klasör değişince yalnızca bir kez çalıştırman yeterli.

## İpuçları
- `02_install_dependencies.command` npm çıktısını uzun gösterebilir; bitince `ok` mesajını görürsün.
- `03_prisma_prepare.command` sorularına `y` veya `n` yazarak cevap ver. İşlem bittiyse `[ok]` mesajını görersin.
- `05_export_db.command` artık pencereyi açık tutar; mesaj çıktıktan sonra aynı pencerede `npm run db:ensure`, `npm run db:reset`, `npm run seed:mp18` gibi komutları girebilirsin.
- Betikler hata verdiğinde kırmızı mesajları bana gönder; gerekiyorsa betikleri güncelleriz.

## Drift veya Migration Hatası Olursa
- `npm run db:reset` komutu tüm tabloları silip migrations dizisini tekrar uygular.
- Ardından `npm run seed:mp18` ile demo veriyi yükleyebilirsin.
- Bu iki komutu en hızlı şekilde çalıştırmak için önce `05_export_db.command` ile ortam değişkenini ayarla.

## Git Yardımcısı
- **90_git_commit.command** local değişiklikleri kolayca stage/commit/push etmek için.
- Betik önce `git status` çıktısını gösterir; istersen varsayılan dosyaları (Terminal betikleri, `.env`, `prisma/identity/dev.db`) otomatik stage eder.
- Gerekirse ek dosya veya desen yazabilirsin (`src/*`, `docs/README.md` gibi).
- Commit mesajı boş bırakılamaz; istersen commit sonrası `git push` da yapar.
