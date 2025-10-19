# Phone Input Bileşeni

`modules/library/components/phone-input` TAXIPartner arayüzlerinde yeniden kullanılabilir telefon numarası giriş deneyimi sağlar. İçeride [intl-tel-input](https://github.com/jackocnr/intl-tel-input) kütüphanesini sarar ve ortak kullanım kurallarını standart hale getirir.

## Hızlı Başlangıç

```js
import { createPhoneInput, PHONE_INPUT_STYLES } from '../../modules/library/components/phone-input/phone-input.js';

const input = document.querySelector('#phone');
createPhoneInput(input, {
  preferredCountries: ['at', 'de', 'tr'],
  onChange({ phone, country, isValid }) {
    console.log(phone, country, isValid);
  }
});

// Stil eklemek için:
const styleEl = document.createElement('style');
styleEl.textContent = PHONE_INPUT_STYLES;
document.head.append(styleEl);
```

> Not: `utilsScript` otomatik olarak `intl-tel-input` paketindeki `utils.js` dosyasına işaret eder. Tüm doğrulama ve formatlama yeteneklerinin çalışması için istemci bundle'ının bu dosyayı servis edebildiğinden emin olun.

## API

| Metot / Alan | Açıklama |
| --- | --- |
| `createPhoneInput(input, options)` | Telefon bileşenini başlatır. |
| `options.onReady(instance)` | `intl-tel-input` hazır olduğunda çağrılır. |
| `options.onChange({ phone, country, isValid })` | Input değeri veya ülke değiştiğinde tetiklenir. |
| `options.initialCountry` | Ulusal format kullanılacaksa varsayılan ülke (örn. `'at'`). |
| `options.countryGroups` | Ülke açılır listesinin sırasını belirleyen ISO kod dizisi (varsayılan öncelik: AT, DE, TR, ardından diğer ülkeler). |
| `instance.formatE164()` | E.164 formatında numara döner (`null` veya `+43699…`). |
| `instance.getSelectedCountry()` | ISO2 ülke kodu (`'at'`, `'de'` vs.) döner. |
| `instance.isValid()` | Geçerli numara olup olmadığını döner. |
| `instance.setNumber(value)` | Programatik olarak numara atar. |
| `instance.destroy()` | Event listener'ları temizler ve bileşeni kapatır. |

### Stil ve Asset Yönetimi

- `PHONE_INPUT_STYLES` sabiti, orijinal CSS içeriğini string olarak döner. Bileşeni kullanmadan önce `<style>` veya uygun bundler mekanizması ile sayfaya ekleyin.
- Varsayılan ayarlar uluslararası formatta çalışır; kullanıcı `+43 699 …` veya `+90 535 …` gibi değerler yazdığında kütüphane [libphonenumber](https://github.com/google/libphonenumber) tabanlı metadata ile ilgili ülkeyi otomatik seçer. Ulusal format bekliyorsanız (`0664…` gibi) uygun `initialCountry` parametresini geçin.
- Stiller hem açık hem de karanlık temaya göre kütüphanede tanımlıdır. Bileşen başka modüllerde kullanıldığında da aynı politika geçerli olur; tüm görsel değişiklikleri `PHONE_INPUT_STYLES` üzerinde merkezî olarak yapmayı tercih edin.
- Uluslararası format API'ye gönderilir (`formatE164()`), input alanı ise yerel formatta kalır.

### Ülke Tespiti ve Dropdown Sırası

Kütüphane ülke tespitini `intl-tel-input` içinde yer alan libphonenumber metadata’sına bırakır. `preferredCountries` ile açılır listenin üst kısmını önceliklendirebilir, `countryGroups` ile özel sıralama belirleyebilirsiniz.

## Yol Haritası

- Design token entegrasyonu (bayrak dışındaki renk/durum görünümlerinin kurumsal temaya uydurulması).
- Jest/Vitest ile davranış testleri ve Playwright üzerinden etkileşim senaryoları.
- Storybook/Vite tabanlı canlı dokümantasyon sayfası.
