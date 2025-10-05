# DEV Anahtar Notları

- Son güncelleme: 2025-09-28 (bu dosyayı yeni ilerleme olduğunda güncelle)
- Aktif portlar: 3000 (identity API), 5173 (admin panel), 5174 (identity SPA). 5175/5176 şu an boş.
- Veritabanı: `identity/dev.db` (SQLite). Docker/Postgres devrede değil.
- MP-17 Part 1/4 durumu: henüz uygulanmadı (schema, notify, scheduler, dokümantasyon bekliyor).

## Yapılacaklar
- [x] MP-17 Part 1: modeller + scheduler + notify altyapısı.
- [x] MP-17 Part 2: Task & Notification REST API + frontend fetch yardımcıları.
- [x] MP-17 Part 2.5: TSX stabilizasyonu, error middleware, smoke script.
- [x] MP-17 Part 2.6: Cron doğrulama, scheduler guard, health, unread count.
- [x] MP-17 Part 3: Tasks/Notifications SPA sayfaları.
- [x] MP-17 Part 3.6: Mevcut başlığa nav + dil seçici entegrasyonu.
- [ ] Gerekirse yeni test ekle ve çalıştır.

## Hızlı Başlangıç Özeti
1. `DEV_RUNBOOK.md` → makine kurulumu ve kalıcı notlar.
2. `DEV_SESSION.md` → günlük terminal komutları.
3. Bu dosya → hangi işlerin devam ettiğini hatırlatır.

## Ek Notlar
- `npm install` komutları her makinede sadece ilk kez gerekli; iCloud sayesinde `node_modules` senkronize edilmez, bu yüzden her cihazda bir kez çalıştır.
- Gün sonunda terminalleri `Ctrl+C` ile kapatmayı unut, aksi halde port çakışması olabilir.
