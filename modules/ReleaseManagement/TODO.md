# Release Management – TODO / Backlog

Bu liste, modül için birlikte takip edeceğimiz gündemi içerir. Her madde kısa, test edilebilir kabul kriterleriyle yazılmıştır.

## P1 (Yüksek Öncelik)
- [ ] Manuel Release Girişi (UI Form)
  - Kabul: Modül içinde “New Release” butonu ile açılan form; `version/date/status/author/description{tr,de,en}` alanları; kaydettiğimde `modules/ReleaseManagement/release-log.json` sonuna eklenir ve tablo anında güncellenir. Hatalı/eksik alanlar için inline uyarı.
- [ ] Şema Doğrulama ve Uyarılar
  - Kabul: `release-log.json` satırları UI yüklenirken doğrulanır; zorunlu alan eksikse satırda uyarı rozeti ve detayda hangi alanların eksik olduğu listelenir.
- [ ] Modül Bazlı Hızlı Filtre (Chips)
  - Kabul: Satırlardaki modül etiketleri tıklanınca üstte “aktif filtre” olarak belirir; çoklu seçim desteklenir; temizle butonu vardır.
- [ ] Erişilebilirlik (Modal & Klavye)
  - Kabul: Detay/karşılaştırma pencereleri için odak tuzağı, `Esc` ile kapama, `aria-*` nitelikleri ve klavye ile gezinme; axe-core ile temel a11y denetimi geçer.
- [ ] Büyük Veri Setleri için Performans
  - Kabul: 1.000+ kayıtla ilk render < 200ms; scroll/render jank yok; sayfalama ve arama debounce ile akıcı.

## P2 (Orta Öncelik)
- [ ] Kolon Sıralama/Saklama Geliştirme
  - Kabul: Kolonlar drag&drop ile yeniden sıralanabilir; görünürlük ve sıra `localStorage`’da kalıcıdır.
- [ ] Kayıtlı Görünümler (Saved Views)
  - Kabul: Mevcut filtre/sıralama/kolon ayarlarını “Save View” ile isimlendirip kaydedebilirim; listeden seçince aynı durum yüklenir.
- [ ] Compare Panel Geliştirme (Özet/İstatistik)
  - Kabul: A/B için `added/modified/removed` dosya sayıları ve rozetleri gösterilir; tek tıkla ilgili listeyi kopyalama.
- [ ] Export Geliştirme (Seçim/Rapor)
  - Kabul: Sadece filtrelenmiş veri değil, işaretlenen satırlar için CSV/JSON/MD dışa aktarma; başlıkta seç‑tümü seçeneği.
- [ ] Repo URL Yönergesi (GitHub Compare)
  - Kabul: `AppConfigRef.repoUrl` boşsa UI’da pasif link ve “scripts/set_repo_url.py” için kısa yönerge; doluysa canlı compare linki.
- [ ] Yardımcı Fonksiyonlar için Testler (Vitest)
  - Kabul: `compareVersion`, `computeReleaseModules`, `diffHighlight` fonksiyonlarına birim testleri; kenar durumları (ör. farklı uzunlukta semver) kapsanır.

## P3 (Düşük Öncelik)
- [ ] Çok Dilli Inline Editör
  - Kabul: Detay görünümünde açıklamayı `tr/de/en` sekmeleriyle düzenleyebilirim; “diğer dilden kopyala” kısa yolu; kaydettiğimde JSON güncellenir.
- [ ] Tema/Sticky İyileştirmeleri
  - Kabul: Yapışkan sütun/başlık dark/light temada kontrast sorunları giderilir; görsel regresyon sorunları düzeltilir.
- [ ] Telemetry Kapsamı ve Oranlama
  - Kabul: Tüm önemli aksiyonlar event olarak kaydedilir; throttle/batch ayarlanabilir; dokümantasyonu `README.md` altında kısa bölüm.

## Yönetişim / CI
- [ ] Freeze Takvimi Doğrulaması (CI)
  - Kabul: CI, `release-calendar.yml` dondurma döneminde release adımlarını uyarı/engel ile işaretler (etiket `release-exception` varsa geçer). `scripts/check-calendar.mjs` kullanılır.
- [ ] Changelog Çıktılarını Gözden Geçir
  - Kabul: `npm run changelog` ile üretilen çıktılar dil bazında doğru formatta; eksik dil varsa `[DRAFT]` notu eklenir.

---

Notlar
- Bu liste başlangıç önerisidir. Öncelikler ihtiyaçlara göre güncellenecektir.
- Kabul kriterleri ölçülebilir ve demo ile doğrulanabilir şekilde yazılmıştır.

