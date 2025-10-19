# AI Prompt Şablonları

## Kod İnceleme
```
Aşağıdaki diff için kritik noktaları çıkar:
- Potansiyel bug veya regressions
- Eksik unit/e2e test önerileri
- Taraf etkileyebilecek güvenlik/rbac durumları

Diff:
{{diff}}
```

## Test Senaryosu Türetme
```
Context: {{modül/bileşen açıklaması}}
Mevcut testler: {{liste}}
Eksik olabilecek test vakalarını sırala; mümkünse GIVEN/WHEN/THEN formatında belirt.
```

## Teknik Not / Runbook Güncelleme
```
Bağlam: {{dosya veya modül}}
Lütfen aşağıdaki değişikliği kısa bir runbook maddesi olarak özetle (madde işaretleriyle, Türkçe):
{{değişiklik açıklaması}}
```

## Prompt Kullanım Notları
- Prompt şablonlarını CLI’dan kullanmayı planlıyorsan `scripts/ai/` altındaki araçları referans al.
- `OPENAI_API_KEY` ortam değişkeni Codespaces ortam değişkenleri üzerinden yükleniyor (`scripts/bootstrap_env.sh`).
- API çağrıları için Node scripti örneği: `scripts/ai/sample-openai.js` (oluşturulacak).
