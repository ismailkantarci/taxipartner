# TP Environment & OpenAI Setup

## 1. Ortam dosyalarını oluştur
- `cp .env.example .env`
- `cp identity/.env.example identity/.env`
- Her iki dosyada da proje ihtiyaçlarına göre değerleri güncelle.

## 2. `./tp` komutuyla otomatik env yükleme
- Repo kökünden `./tp` çalıştırdığında `scripts/bootstrap_env.sh` hem kök `.env` hem de `identity/.env` dosyalarını yükler.
- OpenAI model değişkenleri (`OPENAI_MODEL`, `OPENAI_CODEX_MODEL`) dosyalarda tanımlı değilse betik varsayılanları (`gpt-5-pro`, `gpt-5-codex`) uygular.

## 3. OpenAI bağlantısını doğrula
- Ortam değişkenlerini set ettikten sonra `npm run dev:openai:test` komutunu çalıştır.
- Komut başarılı olduğunda OpenAI API'dan dönen kısa bir yanıt görürsün; hata alırsan anahtar veya ağ konfigürasyonunu kontrol et.

## 4. Güvenlik hatırlatmaları
- `.env` ve `identity/.env` dosyalarını version kontrolüne ekleme.
- Hassas değerleri paylaşmadan önce maskelenmiş çıktılar kullan.
- API anahtarlarını gerektiğinde döndür ve sadece ihtiyaç duyan ekip üyeleriyle paylaş.
