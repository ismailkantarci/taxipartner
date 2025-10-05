# TAXIPartner Identity Starter

TAXIPartner Admin Suite için kimlik modülünün çekirdeğini sıfırdan başlatmak üzere hazırlanmış TypeScript (Node 18+) iskeletidir. Amaç, yönetim rollerinin değişmezliğini koruyan ve kiracı bazlı iş rolleri için şablonlar sunan güvenli bir rol atama yöntemi sağlamaktır.

## Kurulum
```bash
cd identity
npm install
```

## Testleri Çalıştırma
```bash
npm run test
```
> Test komutu `tsx` ile `node:test` çatısını kullanarak `tests/roleGuard.spec.ts` dosyasını çalıştırır.

## İş Kuralları
- Governance roller (`Superadmin`, `Wirtschaftsprüfer`, `Compliance Officer`, `Internal Auditor`, `Kontroller`) sistem tarafından sabitlenmiştir ve çoğu tekildir.
- İş (tenant) rolleri şablon niteliğindedir; her kiracıda çoğaltılabilir (`Steuerberater`, `Fahrer`, `GF`, vb.).
- Ayrıcalık ayrımı (Segregation of Duties) tekil roller ve uyumsuz rol çiftleriyle uygulanır.
- Denetim/eğitim rolleri (`Kontroller`, `Wirtschaftsprüfer`, `Compliance Officer`, `Internal Auditor`) atanırken kullanıcıda kiracı listesi ve raporlama dönemi claim’leri bulunmak zorundadır.
- Atama sırasında MFA devreye alınır, aktif oturumlar kapanır ve Avrupa/Viyana saat dilimi varsayıldığı için audit kayıtları bu bağlama göre planlanır.

## Klasör Yapısı
- `seeds/`: Roller ve uyumsuzluklar için JSON kaynakları.
- `src/`: Tür tanımları, izin katalogu, claim kuralları, rol koruyucusu ve örnek HTTP handler’ı.
- `tests/`: `node:test` ile yazılmış temel güvenlik senaryoları.

Bu starter, ileride gerçek veritabanı, SSO/MFA akışları ve diğer domain modülleriyle bütünleşmeye hazır minimal bir temel sunar.

## Role → Permission Templates
- Seed dosyası: `identity/seeds/seed_role_permissions.json`
- Yardımcı fonksiyonlar: `identity/src/permissionTemplates.ts`
- Örnek bağlayıcılar: `identity/seeds/seed_role_bindings.example.json`

Şablon testlerini `tsx` ile çalıştırmak için:
```bash
npm run test
```

## Minimal Admin Panel (Demo)
- Dosyalar: `identity/public/admin.html`, `identity/public/admin.js`
- Yayın adresi: `http://localhost:3000/admin`
- Özellikler:
  - Kullanıcı ID girme
  - /seed/roles ile gelen rolden seçim
  - `/assign-role` uç noktasıyla rol atama
  - Sonucu JSON olarak ekranda gösterme

> Not: Bu arayüz yalnızca demo amaçlıdır. Gerçek ortamda kalıcı veritabanı, kimlik doğrulama ve üretim için uygun bir frontend çerçevesi ile entegre edin.
