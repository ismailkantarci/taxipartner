# Codespaces Kullanım Rehberi

## Otomatik adımlar
- Devcontainer açıldığında `postCreateCommand` otomatik olarak `./tp setup` çalıştırır. İlk kurulumda bağımlılıklar yüklenir, Prisma client üretilir.
- Her başlatmada `postStartCommand` ile `./tp start` tetiklenir; `npm run codespaces:start` dev servislerini paralel açar (3000, 5173, 5174 portları).
- 8080 portu Docker RC testi için rezerve edildi; postStart sırasında dokunulmaz fakat port haritalaması tanımlı.

## Manuel kısayollar (`tp` komutu)
| Komut | Açıklama |
|-------|----------|
| `tp start` | Dev servisleri başlatır (varsayılan davranış). |
| `tp setup` | `Codespaces/01_bootstrap.sh` çalıştırarak bağımlılık yükler. |
| `tp lint` / `tp typecheck` / `tp test` | Root `npm` scriptlerini tetikler. |
| `tp rc-build` | `infra/Dockerfile` ile prod imajını oluşturur. |
| `tp docker-up` / `tp docker-stop` | RC imajını 8080 portunda açar/kapatır. |
| `tp lighthouse` | RC konteyneri açıksa Lighthouse skorlarını üretir (`TP_LIGHTHOUSE_REPORT=1` ile HTML kaydı). |

## Performans / bakım önerileri
- Uzun süreli servisler kapatılacaksa `Ctrl+C` ile `tp start` çıktısını durdurmak yeterli; portlar serbest kalmazsa `tp start` yeniden çalıştırmadan önce `Codespaces/10_start_all.sh` scripti port yönetimini yapar.
- Büyük bağımlılık güncellemeleri sonrası `tp setup` komutunu manuel çalıştırarak `npm install` + `prisma generate` adımlarını yeniden tetikle.
- RC kalitesi için `npm run verify` (lint + unit; typecheck şimdilik stub) ve `npm run verify:rc` (build + lighthouse + e2e) komutlarını kullan.
- Codespace kaynak kullanımı için: `gh codespace top -c $CODESPACE_NAME` ve GitHub portalındaki “Usage” sekmesini izle.
- Database gibi ek servisler gerekiyorsa (docker compose) `Codespaces/01_bootstrap.sh` bunu destekliyor; gerekirse script içerisinde özelleştirme yap.

## Faydalı referanslar
- [terminal-notes.md](../terminal-notes.md): Geliştirme komutlarının hızlı özeti.
- [notlar/README.md](../notlar/README.md): Tüm proje notlarının indeks tablosu.
- [docs](./) klasörü: Bu dokümanla başlayan iç rehberler.
