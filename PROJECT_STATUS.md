# Proje Durum Özeti

> Bu dosya Codespaces açıldığında hızlı bakış ekranı olarak düşünüldü. Her önemli çalışma sonrasında güncellenmelidir.

## Son Güncelleme
- Tarih: 2025-10-18
- Sorumlu: Codex – Tenants companies pagination entegrasyonu & alt sekme analizi

## Son Çalışmalar
- Legacy `frontend` modüllerindeki (auth, tasks, notifications, tenants, users) `any/unknown` kullanımları daraltıldı, yeni tip tanımları `frontend/tenants/types.ts` ile paylaşıldı.
- Fetch header yardımcıları `frontend/api/http.ts` altında birleştirildi; JSON türleri `frontend/types/json.ts` dosyasında toplandı.
- `npm run verify` (lint + typecheck + vitest) başarıyla tamamlandı; legacy sayfalar artık tip denetiminde temiz.
- Legacy montaj sayfalarındaki DOM seçimleri `frontend/ui/dom.ts` yardımcıları ile null-safe hale getirildi, tenant/local storage anahtarları `frontend/ui/storageKeys.ts` altında toplandı.
- `modules/*` paketlerine yönelik `.d.ts` dosyaları eklendi (ör. `modules/Companies`, `modules/Settings`, `modules/library`), `ModuleLoader` ve `AppState` API'leri dâhil olmak üzere JS modüllerinin TypeScript tarafından güvenle tüketilmesi sağlandı.
- `src/data` altındaki IAM seed setleri (`iamRoles`, `iamPermissions`, `iamSessions`, `iamUsers`, `iamAuditLogs`) ortak `iamTypes.ts` ile tiplenip `src/data/index.ts` üzerinden yeniden dışa aktarıldı; ilgili sayfalar yeni tipleri kullanacak şekilde güncellendi.
- Identity API’de `GET /tenants` uç noktası sıralama/sayfalama (sort/order/page/pageSize) ve toplam kayıt (`total`) meta bilgisi dönecek şekilde genişletildi; legacy SPA bu değişimle uyumlu.
- Legacy Tenants SPA listesi yeni sayfalama/sıralama metalarını kullanacak şekilde güncellendi; arama, durum filtresi ve ileri/geri kontrolleri eklendi.
- Identity API’ye `GET /tenants/:id/companies` uç noktası eklendi; arama/sıralama/sayfalama ve temel sayım metrikleri döndürüyor.
- Legacy `frontend/companies/page.ts` artık `/tenants/:id/companies` uç noktasını tüketiyor; arama/sıralama parametreleri, sayfalama durumu ve CSV çıktısı yeni sayaç sütunlarıyla uyumlu hale getirildi.
- Organizations/Mandates/Org Units/Vehicles alt sekmelerinin mevcut durum analizi tamamlandı; açık noktalar ve öncelikler `notlar/tenant-ist.md` içerisinde kayda geçirildi.
- Prisma şemasına `Organization` ve `Mandate` modelleri eklendi; Identity `tenants.routes.ts` üzerinden `/tenants/:id/organizations|mandates` için liste + CRUD uçları sağlandı.
- Org Units servisi `/tenants/:id/ous` endpointine taşındı; frontend (`frontend/ous/*`) modern sayfalama, arama ve detay paneli ile güncellendi.
- Vehicles servisi `/tenants/:id/vehicles` listesini, create/update/delete (Archive) akışlarını ve front-end (`frontend/vehicles/*`) filtre/sıralama desteğini kapsayacak şekilde yenilendi.
- Placeholder durumundaki Organizations ve Mandates modülleri gerçek SPA sayfalarına dönüştürüldü; module-loader mount işlemini sürdürüyor.
- Hata kodu↔i18n eşlemesi ve `metaJson` şeması için `docs/tenant-domain-roadmap.md` hazırlandı.

## Servis / Ortam Durumu
| Servis | Komut | Port | Not |
|--------|-------|------|-----|
| Identity API | `tp start` (veya `npm --prefix identity run dev`) | 3000 | `.env` zorunlu anahtarları kontrol edilir. |
| Admin SPA (Vite) | `tp start` (veya `npm run dev:vite`) | 5173 | Hot-reload ortamı. |
| Identity SPA | `tp start` (veya `npm --prefix frontend run dev`) | 5174 | Login/invite arayüzü. |
| Admin Nginx (RC) | `tp docker-up` | 8080 | Docker imajı ile prod benzeri test. |

## Kritik Dokümanlar
- [terminal-notes.md](terminal-notes.md)
- [docs/codespaces-usage.md](docs/codespaces-usage.md)
- [notlar/README.md](notlar/README.md)

## Açık Başlıklar
- OPENAI_API_KEY secretʼı Codespaces ortamına eklenmeli (`notlar/openai-setup.md`).
- RC ölçümleri için `tp rc-build` + `tp docker-up` + `TP_LIGHTHOUSE_REPORT=1 tp lighthouse` veya `npm run verify:rc` komutları kullanılmalı.
- GitHub Actions: `Codespaces Prebuild` ve `Release Candidate Verify` workflow’larının sonuçları izlenmeli, gerekirse cache optimizasyonu yapılmalı.
- AI CLI kullanmadan önce secret doğrulamasını yap; örnek: `node scripts/ai/sample-openai.js "selam"`.
- Typecheck adımı `tsconfig.typecheck.json` ile yeniden aktif; repo adapter katmanı + audit/compliance/risk/goals feature’ları ve `src/pages/**/*` altındaki tüm ekranlar ile legacy `frontend` modülleri (audit, auth, companies, notifications, ous, tasks, tenants, users vb.) kapsama alındı. Yeni modüller eklerken uygun hedefleri bu dosyaya ekle.
- Lint uyarıları sıfırlandı (`eslint . --max-warnings=0`); yeni modüller eklerken `import type` ve async promise yönetimi için aynı standardı takip et.
- Organizations/Mandates akışları için i18n hata mesajları, metaJson şema rehberi ve domain validasyonlarının tamamlanması gerekiyor (bkz. notlar/tenant-ist.md).
- Org Units / Vehicles ekranlarında gelişmiş özellikler (ağaç görünümü, toplu durum değişimi, status event logları) planlanmalı; telemetry izlemesi güncellenecek.

> Hatırlatma: Bu dosyayı güncel tutmak senin sorumluluğunda. Her sprint sonunda “Son Güncelleme” bölümünü güncelle ve kapatılan/açılan başlıkları burada özetle.
