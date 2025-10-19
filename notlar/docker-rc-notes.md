# Docker RC Notları

## Ne zaman Docker kullanıyoruz?
- Release/RC doğrulaması veya prod benzeri smoke testi yapılacaksa.
- Güvenlik header’ları, Lighthouse skorları gibi build çıktısına bağlı kontroller istendiğinde.
- Dağıtım için paylaşılabilir imaj/paket gerekiyorsa (ör. registry’ye push).
- “Hot-reload” yerine statik build çıktısını görmek isteniyorsa.

## Codespaces’te standart akış
1. `docker build -t taxipartner-admin:rc1 -f infra/Dockerfile .`
2. `docker run -d -p 8080:80 --name tp-admin-rc1 … taxipartner-admin:rc1`
3. Header testi: `curl -I http://127.0.0.1:8080 | grep -E 'X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy'`
4. Sağlık kontrolü: `curl -s http://127.0.0.1:8080/healthz`
5. İşi bitince konteyneri kapat: `docker stop tp-admin-rc1`

## Notlar
- `tp` alias’ı yalnızca dev servislerini (Vite/identity) başlatıyor; Docker süreci ayrı tutulmalı.
- Gerekirse Docker için ayrı bir alias eklenebilir (`tp docker-up` gibi), ancak şu an manuel adımlar yeterli.
- İmajı registry’ye göndereceksek tag/push komutlarını bu flow’un devamına eklemeliyiz.
