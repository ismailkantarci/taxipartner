# Terminal Kısayolları

Dosyalar sıralı olarak çalıştırılacak şekilde numaralandırıldı. Her `.command` dosyasını çift tıkladığında yeni bir Terminal penceresi açılır ve komutlar otomatik çalışır.

## Çalıştırma Sırası
1. **01_env_check.command** – Node sürümü ve `identity/.env` kontrolleri.
2. **02_install_dependencies.command** – Root ve `identity` klasörlerinde `npm install` çalıştırır.
3. **03_prisma_prepare.command** – `npx prisma generate` ve isteğe bağlı seed/migration.
4. **10_start_identity.command** – Identity API (`http://localhost:3000`).
5. **20_start_admin.command** – Admin paneli (`http://localhost:5173`).
6. **30_start_identity_spa.command** – Identity SPA (`http://localhost:5174`).
7. **40_start_tailwind.command** – Tailwind watcher (isteğe bağlı).

## İlk Kurulum
```bash
cd "/Users/ismailkantarci/Documents/TAXIPartner Admin Suite"
chmod +x Terminal/*.command
```
Bu komutu klasör değişince yalnızca bir kez çalıştırman yeterli.

## İpuçları
- `02_install_dependencies.command` npm çıktısını uzun gösterebilir; bitince `ok` mesajını görürsün.
- `03_prisma_prepare.command` sorularına `y` veya `n` yazarak cevap ver. Soruları kaçırırsan `Ctrl + C` ile iptal edip yeniden çalıştırabilirsin.
- Betikler hata verdiğinde kırmızı mesajları bana gönder; gerekiyorsa betikleri güncelleriz.
