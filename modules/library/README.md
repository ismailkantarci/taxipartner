# TAXIPartner Library

Bu dizin, TAXIPartner arayüzlerinde ortak kullanılan tasarım öğeleri ve teknik bileşenlerin merkezi kütüphanesidir. Tasarım sistemi seviyesinde çalışmayı hedefler ve aşağıdaki yapı üzerinde ilerler:

- `tokens/`: Renk, tipografi, boşluk, breakpoint gibi tasarım token kaynakları.
- `components/`: Yeniden kullanılabilir UI bileşenleri ve davranışsal katmanlar (ör. telefon numarası girişi).
- `docs/`: Kullanım örnekleri, yönergeler ve bileşen belgeleri.
- `docs/demo`: Bileşenleri görsel olarak deneyebileceğin mini demo sayfaları (örn. `npm run library:demo` ile açılan telefon bileşeni vitrini).
- `scripts/`: Token senkronizasyonu, build ve yayın süreçlerini destekleyen yardımcı komutlar.

Her bileşen/alt paket semantik versiyonlama prensipleriyle geliştirilmeli, dokümantasyon ve testleriyle birlikte bu klasör altında yer almalıdır.

## Tasarım Token'ları

`tokens/index.js` dosyası renk, tipografi, spacing ve breakpoint değerlerini paylaşır:

```js
import { colors, typography, spacing, breakpoints } from '@taxipartner/library/tokens/index.js';

console.log(colors.brand.primary); // #2563eb
console.log(spacing[8]); // 1rem
```

Bu değerler Tailwind, CSS-in-JS ya da düz CSS değişkenleri oluşturmak için kullanılabilir. Tüm projelerde tutarlı görünüm için yeni görsel ihtiyaçları bu dosyaya ekleyin ve dokümantasyonunu güncelleyin.

## Build & Test

Kütüphane paketini derlemek için depo kökünden:

```bash
npm run library:build
```

Telefon bileşeni için birim testi çalıştırmak:

```bash
npm run library:test
```
