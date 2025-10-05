# Release Management — Görsel Yenileme Planı

## 1. Mevcut Durum Analizi
- **Yoğun üst katman:** KPI kartları, filtre paneli, kontrol çubuğu ve tablo aynı anda görünerek ilk ekranda bilgi yükü oluşturuyor.
- **Filtre deneyimi:** Masaüstünde dört sütunlu form kalabalık; mobilde drawer iyi çalışıyor ancak varsayılan açık olması dikkat dağıtıyor.
- **Kontrol barı:** Compare, kayıtlı görünümler, sayfalama, tema seçici gibi farklı bağlamlar tek satıra yığılmış durumda.
- **Benzer yüzey tonları:** Tema token’ları olsa da kartlar, drawer ve toolbar aynı renk ailesini kullandığından derinlik hissi zayıf.
- **Modal akışı:** Manual Release formunda üç dil alanı aynı anda gösteriliyor; detay modalları uzun listelerle dikey akıyor.
- **Empty state:** Style sandbox’ta var fakat gerçek modülde tablo/kart boşken yeterince öne çıkmıyor.

## 2. Tasarım Hedefleri
1. **Profesyonel izlenim:** Beyaz alanı artır, hiyerarşiyi sadeleştir, kontrastı kontrollü kullan.
2. **Kullanılabilirlik:** Temel aksiyonları görünürde tut, ileri düzey filtreleri gerektiğinde göster.
3. **Esneklik:** Kart ve tablo görünümü arasında bilinçli geçiş; küçük ekranlarda drawer ve bottom sheet çözümleri.
4. **Tutarlılık:** Tema token seti (renk, tipografi, spacing) Light/Dark arasında aynı hissi versin.
5. **Erişilebilirlik:** Odak hiyerarşisi, `aria-*` bağlamları, hata mesajları ve microcopy sade olsun.

## 3. Önerilen Sayfa Yapısı
```
┌────────────── KPI Panel (3 kart) ───────────────┐
│  Toplam  ○ 30g/son  ○ Stable ratio  │ Benchmark │
└──────────────────────────────────────────────────┘

┌──────────── Toolbar (sekme bazlı) ──────────────┐
│ Görünüm | Navigasyon | Analiz                 │
└──────────────────────────────────────────────────┘

┌───── Drawer (Filtreler) ─────┐  ┌────── Veri yüzeyi ─────┐
│ Temel filtreler (status, arama) ││ Tablo ↔ Kart toggle    │
│ Gelişmiş filtre (accordion)     ││ Tabloda virtual scroll │
└───────────────────────────────┘ │ Kart listesi responsive│
                                  └────────────────────────┘
```
- Drawer varsayılan kapalı; toolbar’da “Filters” düğmesi ile açılır.
- Kart görünümü tablet ve küçük ekranlarda default olabilir; masaüstünde tablo.
- Selection bar floating olarak tablo üzerinde konumlanır, sadece seçim olduğunda görünür.

## 4. Tema & Stil Notları
- **Renk paleti:**
  - Surface Base `#F8FAFC`, Raised `#FFFFFF`, Overlay `#111827` (80% opaklık).
  - Accent1 `#3B82F6`, Accent2 `#0EA5E9`, destekleyici nötr `#475569`.
- **Tipografi:**
  - Başlıklar: Inter SemiBold 18/24.
  - Meta: Inter Medium 13/20.
  - Microcopy: Inter Regular 12/18, %70 opak gri.
- **Spacing:** 4/8/12/16 px tokenları; kart içi padding 20 px, drawer padding 24 px.
- **Bileşen stilleri:**
  - Kartlar köşe yarıçapı 16 px, hafif gölge 0 10px 30px rgba(15,23,42,0.06).
  - Butonlar: Primary (Accent1 arka plan), Secondary (outline + nötr metin), Tertiary (metin link).
  - Checkbox/radio `accent-color: #3B82F6`.

## 5. Modallar & Formlar
- Manual Release: Üç dil alanını sekmeli yap; zorunlu alanları üstte tek sütun, opsiyonelleri ikinci adım.
- Detay modali: Bilgi bloklarını iki sütuna böl, alt kısma accordion (files/diff) yerleştir.
- Compare modali: Başlık çubuğuna kısa opsiyonlar, içerikte sticky summary + diff tablo.

## 6. Aksiyonlar & Boş Durumlar
- Empty state bileşenini tablo/kart içinde göster; CTA butonu (New Release) ve quick filter chip’leri.
- Selection bar: “Export / Compare / Delete” dropdown şeklinde; ikinci satır yok.
- Repo hint & benchmark bilgisi: Table header’daki info badge + tooltip.

## 7. Uygulama Adımları
1. Yerleşim refaktörü (drawer varsayılan kapalı, yeni toolbar sekmeleri, toggle).
2. Tema token setinin revizyonu, Light/Dark varyasyonlarının güncellenmesi.
3. Modal/form yeniden düzeni (sekme, iki sütun, a11y iyileştirmeleri).
4. Empty state + action menü revizyonu, microcopy güncellemesi.
5. Son rötuşlar: Benchmark/info badge, kart hover, doc/screenshot güncellemeleri.

Hazırlık tamam; bir sonraki adım yerleşim refaktörü.
