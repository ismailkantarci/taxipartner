# Lighthouse Sonuçları

Bu doküman, Docker RC testi veya prod build sonrası alınan Lighthouse raporlarının özetini tutmak için oluşturuldu. Raporları `docs/lighthouse/` klasörüne kaydedebilir, burada kısa başlıklar halinde özetleyebilirsin.

## Son Ölçümler
- Tarih: _(güncelle)_
- Ortam: Docker RC (8080)
- Skorlar: Perf __, A11y __, Best Practices __, SEO __
- Notlar: _(ör. hangi sayfalar ölçüldü)_

## Komut
```
TP_LIGHTHOUSE_REPORT=1 tp lighthouse
```
veya CI senaryolarında:
```
npm run verify:rc
```
komutları Lighthouse ölçümlerini `docs/lighthouse/` altına kaydeder.

> Raporlar büyük olduğu için `docs/lighthouse/` altına kaydedip gerekirse `.gitignore` ile yönetebilirsin.
