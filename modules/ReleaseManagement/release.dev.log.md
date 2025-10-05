# Release Management – Geliştirme Günlüğü (release.dev.log.md)

### 2025-05-28 — ChatGPT
- Modül eski arşivden alınan `releaseManager.module.js` içeriğiyle yeniden kurgulandı
- AppState entegrasyonu sağlandı (`AppState.activeModule`)
- Tablo yapısı `overflow-x-auto` ile responsive hale getirildi
- Scroll taşmaları engellendi, sadece tablo içeriği kayar hale getirildi
- Sayfa hizalama sorunu giderildi; Dashboard ile aynı paddings (`px-6`) ve yapı
- `target.innerHTML` temizlendi, sadeleştirildi

### Yapı Standardı:
- Tüm tablo modülleri `div.overflow-x-auto` içinde yer alır
- `table.min-w-[700px]` ile mobil scroll desteklenir
- Dış container `#modulContent`’in padding’ine göre hizalanır

### 2025-09-21 — ChatGPT
- Filtre paneli ve kontrol barı için tema token’ları (`--rm-surface*`, `--rm-border-soft*`, `--rm-accent-*`) tanımlandı; light/dark/tema varyasyonları tek CSS’ten yönetiliyor.
- 900 px altında kart görünüme geçiş, tablo/kart seçim durumunun senkron tutulması ve şema uyarı rozetleri eklendi.
- Manual Release modalı klavye tuzağı, alan ipuçları ve semver/duplicate doğrulaması ile tamamlandı; kaydet-sonrası anında tablo yenileniyor.
- Schema doğrulama hataları kartlarda, tablo satırlarında ve detay/inline görünümde (örn. `! Schema`) gösteriliyor.
- Seçim çubuğu (Export/Copy/Compare/Delete) ve modül filtre chip’leri locale’lere göre metinler ile `localStorage` kalıcılığı sağlar hale getirildi.
- CSV / Markdown / HTML export akışları (telemetri log’ları dahil) güncellendi; HTML raporu metrik kartları ve tema bilgisiyle gelir.
- `renderFiles` ve diff görünümü HTML kaçışları güçlendirildi; bağlı vitest senaryoları (`tests/release.renderfiles.escape.test.js`, `tests/release.selection.test.js`, `tests/release.export.csv.test.js`, `tests/releaseManagement.utils.test.js`) eklendi.
