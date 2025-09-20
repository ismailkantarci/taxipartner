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
