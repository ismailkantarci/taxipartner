# Easyname (FTP) Dağıtım Süreci — Legacy

Bu belge, TAXIPartner arayüzünün Easyname FTP alanı üzerinden manuel olarak yayınlandığı eski akışı referans olarak saklar. Netlify’a geçiş sonrası yalnızca geçmiş sürümlere dönmek gerektiğinde kullanılmalıdır.

## Adımlar
1. **Kaynak kontrol** – Geliştirmeler Git deposunda yapılır. Easyname FTP alanına yalnızca derlenmiş çıktıyı (`dist/`) yükleyin; depo dosyalarını doğrudan FTP’ye taşımayın.
2. **Derleme** – Yerelde veya CI içinde `npm run build` çalıştırın. Çıktı UTF-8 uyumlu olarak `dist/` dizinine düşer (Tailwind + modüler `init(target)` mimarisi korunur).
3. **Çok dillilik ve tenant kontrolü** – `dist/` içindeki `index.html`, `locales/` ve `modules/` içeriği `de-AT`, `tr-TR`, `en-GB` varyantlarını ve tenant tabanlı yüklemeyi sürdürür. Easyname’e aktarırken dizin yapısını aynen koruyun.
4. **FTP senkronizasyonu** – Easyname’in sağladığı FTP/SFTP hesabına bağlanın. WIX içeriği tutulacaksa TAXIPartner yönetim arayüzü için ayrı bir alt klasör (`/admin/` gibi) oluşturun; tam geçişte DNS `admin.taxipartner.at` Easyname barındırmasına yönlendirildiğinde `dist/` içeriğini kök dizine (veya belirlenen alt dizine) yükleyin.
5. **Sürümleme ve yedek** – Yayın öncesinde Git’te tag/commit oluşturun. FTP’ye yüklenen dosyaların bir kopyasını `release-pack/` biçiminde saklayın ki gerekirse rollback yapılabilsin.
6. **Otomasyon** – Manuel yükleme yerine `lftp`, `rsync` (SFTP) ya da Easyname API destekliyorsa CI betiği kullanabilirsiniz. Betik `npm run build` sonrasında sadece `dist/` içeriğini ve gerekli yapılandırma dosyalarını (`app.config.json`, `.env.production`) aktarır.
7. **Backend entegrasyonu** – Easyname yalnızca statik dosyaları sunar; kimlik sağlayıcısı (`/auth` endpoint’leri) ve API mevcut backend hostunuzda çalışmalıdır. `app.config.json` içindeki `identity.baseUrl` ve `api.baseUrl` değerlerini canlı ortama uygun koruyun.

## Ne Zaman Kullanılır?
- Netlify veya yeni hosting geçici olarak ulaşılamazsa.
- Eski Easyname tabanlı sürümlere rollback yapılması gerekiyorsa.
- Easyname FTP üzerinde kalan içerikleri temizleme ya da arşivleme çalışmaları yapılırken referans alınması gerekiyorsa.

> Uyarı: Easyname FTP dağıtımı otomasyon ve sürümleme açısından Netlify CI/CD’ye göre çok daha kırılgandır. Canlı sistem için yalnızca kısa süreli geçiş durumlarında tercih edilmelidir.
