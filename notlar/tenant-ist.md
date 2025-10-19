# Tenants Modülü – IST Analizi ve Yol Haritası

## IST Özeti
- **Frontend (legacy SPA)**: `frontend/tenants/page.ts` tek dosyada ~1700 satırlık saf DOM işleyişi barındırıyor; tüm formlar (tenant yaratma, kullanıcı atama, corporate action, pay sahipliği, ekler, araç/sürücü atamaları, approvals) manuel state ile yönetiliyor. API erişimi `frontend/tenants/api.ts` üzerinden Identity servisine gidiyor. `frontend/companies/page.ts` artık `GET /tenants/:id/companies` uç noktasıyla arama/sıralama/sayfalama ve sayaç metalarını tüketiyor.
- **Hash router entegrasyonu**: `attachTenantsRoute` aktif; nav’daki diğer tenant sekmeleri (`Companies`, `Org Units`, `Vehicles`, `Mandates`, `Organizations`) legacy module-loader üzerinden yükleniyor. Companies/Org Units/Vehicles/Organizations/Mandates SPA’leri artık yeni `/tenants/:id/*` uç noktalarından veri alıyor; module-loader yalnızca mounting için kullanılıyor.
- **Hata mesajları ve metaJson**: Identity uçları hata kodu döndürüyor; karşılık gelen i18n anahtarları ve `metaJson` kullanım rehberi `docs/tenant-domain-roadmap.md` dosyasında kayıtlı.
- **Identity API (TS)**: `identity/src/tenants.routes.ts` kapsamlı Express router; tenant oluşturma/güncelleme, kimlik yönetimi, corporate action, shareholding, officer, vehicle/driver assignment, attachment ve approval uçlarını Prisma transaction’larıyla sağlıyor. Bazı guard’lar (örn. `scopeGuard`) içe aktarılmış olsa da kullanılmıyor; hata mesajları karışık (TR/EN).
- **Diğer modüllerle ilişki**: Prisma şeması tenant ile ilişkili pek çok tablo barındırıyor (`Tenant`, `Company`, `OU`, `Shareholding`, `VehicleAssignment`, vb.). Frontend hâlâ localStorage/AppState üzerinden tenant seçimini yönetiyor; legacy module-loader bileşenleri ile yeni SPA arasında tutarlılık net değil.
- **Eksik/placeholder kısımlar**: Organizations ve Mandates ekranları tamamen placeholder; veri modeli ve API uçları yok. Org Units/Vehicles legacy uç noktalara yaslandığı için meta/paging desteği bulunmuyor. Test veya otomasyon hâlâ yok.

## Yapılacaklar (Backlog)
1. **API Yüzeyi Senkronizasyonu**
   - [x] `GET /tenants` çağrısına sıralama, sayfalama ve toplam kayıt meta bilgisi eklendi (sort/order/page/pageSize/total destekleniyor).
   - [x] `GET /tenants/:id/companies` uç noktası eklendi; arama/sıralama/sayfalama + temel sayım metrikleri (permit/officer/shareholding) döndürüyor.
   - [ ] Identity’de eksik olan `/tenants/*` alt uç noktalarını hizala:
     - [x] `/tenants/:id/companies` (arama/sıralama/sayfalama + sayaç metaları hazır)
     - [x] `/tenants/:id/organizations` (CRUD + meta listesi hazır)
     - [x] `/tenants/:id/mandates` (CRUD + meta listesi hazır)
     - [x] `/tenants/:id/ous` (tenant parametreli, arama & sayfalama destekli)
     - [x] `/tenants/:id/vehicles` (tenant-odaklı listeleme, filtre/sıralama destekli)
   - [ ] Mevcut TS router’daki `scopeGuard` / permission kullanımını gözden geçir; çok tenantlı erişim kontrolünü netleştir.
2. **Frontend Refaktörü**
   - [x] Tenants listesi yeni API sayfalama/sıralama metalarını kullanacak şekilde güncellendi; arama, durum filtreleri ve ileri/geri kontrolleri eklendi.
   - [ ] `frontend/tenants/page.ts` dosyasını bileşen bazlı modüler yapıya taşı; form state’lerini sadeleştir, hataları toast/panel ile yönet.
   - [ ] Tenant alt sekmelerini yeni API mimarisiyle hizala:
     - [x] Companies legacy sayfası `/tenants/:id/companies` + sayfalama/sıralama + csv destekleriyle güncellendi.
     - [x] Org Units ekranını `/tenants/:id/ous` uç noktası, arama/sayfalama/metrikleriyle güncelle; parent seçeneklerini dinamikleştir.
     - [x] Vehicles ekranını `/tenants/:id/vehicles` uç noktası üzerine kur; şirket filtresi, sıralama ve durum güncellemeleri senkron.
     - [x] Organizations ve Mandates modüllerini yeni API akışlarıyla gerçek CRUD UI’sine dönüştür.
3. **Durum Yönetimi & Seçili Tenant**
   - AppState / localStorage kullanımını standardize et; `modules/*` ve yeni SPA aynı kaynağı kullansın (ör. tek bir `selectedTenantId` anahtarı).
   - Tenants ekranında seçili tenantı store’a yazıp diğer modüllerin otomatik yüklenmesini sağla.
4. **Validasyon & UX**
   - Backend’deki hata mesajlarını i18n’e taşı; client-friendly hata yapısı tanımla.
   - Formlarda inline validasyon ve erişilebilirlik iyileştirmeleri (label, aria, disable state) ekle.
5. **Test ve Dokümantasyon**
   - Identity router için Prisma tabanlı entegrasyon testleri ekle.
   - Frontend için smoke/e2e senaryoları (tenant oluşturma, kimlik ekleme, paylaşım) hazırlayıp CI’ya bağla.
   - Dokümantasyonu (PROJECT_STATUS / RUNBOOK) güncel API haritası ve tenant yaşam döngüsüyle genişlet.

## Tenant Alt Sekmeleri Analizi (2025-10-18)
- **Companies**: `frontend/companies/page.ts` Identity’deki `GET /tenants/:id/companies` uç noktasıyla arama/sıralama/sayfalama + sayaç metrikleri tüketiyor.
- **Organizations**: `frontend/organizations/page.ts` yeni `/tenants/:id/organizations` API’si üzerinde CRUD, arama/sıralama/sayfalama ve son mandatelar listesi ile çalışıyor; module-loader artık gerçek UI’yı mount ediyor.
- **Mandates**: `frontend/mandates/page.ts` `/tenants/:id/mandates` uç noktasıyla filtre, organizasyon seçicisi, durum/valid tarih alanları ve CRUD desteği sağlıyor.
- **Org Units**: `frontend/ous/page.ts` yeni `/tenants/:id/ous` endpoint’inden meta/paging alıyor; create/edit formları parent seçeneklerini dinamik dolduruyor.
- **Vehicles**: `frontend/vehicles/page.ts` `/tenants/:id/vehicles` listesini kullanıp VIN/şirket filtresi, status yönetimi ve arşivleme akışını destekliyor.

### Önceliklendirilmiş Aksiyon Listesi
1. Organizations/Mandates domainleri için detaylı validasyon ve meta şemalarını netleştir; i18n hata mesajlarını genişlet.
2. Org Units ve Organizations için toplu içe-aktarım / ağaç görünümü gibi gelişmiş UX ihtiyaçlarını planla.
3. Vehicles için toplu durum güncelleme ve tarihçeyi UI’da surfaces et; status event loglarını kullanıcıya göster.

> Not: Bu dosya Tenants modülündeki çalışmalar için referans olarak kullanılacak. Her iterasyon sonunda IST bölümünü güncelle ve ilgili backlog maddesini kapat.
