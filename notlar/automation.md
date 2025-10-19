# Otomasyon Özeti

- **tp komutu**: `setup`, `start`, `lint`, `typecheck`, `test`, `rc-build`, `docker-up`, `docker-stop`, `lighthouse` alt komutları ile Codespaces görevlerini tekilleştiriyor.
- **Lint Ayarları**: `eslint.config.mjs` rootDir kullanacak şekilde güncellendi; Storybook dosyaları için `no-require-imports` devre dışı.
- **Lint durumu**: `eslint . --max-warnings=0` yeşil; type-only importlar `import type` ile düzeltildi, async çağrılar `void`/`await` ile temizlendi.
- **npm scriptleri**: `npm run verify` (lint + hedefli typecheck + unit test), `npm run verify:e2e`, `npm run verify:rc` (build + lighthouse + Playwright). RC doğrulaması `scripts/ci/rc-verify.mjs` üzerinden yönetiliyor. `npm run typecheck` artık `tsc -p tsconfig.typecheck.json` kullanıyor; repo adapter katmanı, tüm `src/pages/**/*` ekranları ve legacy `frontend` modülleri (audit, auth, companies, notifications, ous, tasks, tenants, users vb.) kapsama dahil, yeni alanlar eklenirken bu dosyayı güncelleyin.
- **2025-10-18**: Legacy `frontend` modüllerinde tip temizlikleri tamamlandı; ortak header helper `frontend/api/http.ts` altına alındı. Montaj sayfalarındaki DOM seçimleri `frontend/ui/dom.ts` üzerinden null-safe hale getirildi ve localStorage anahtarları `frontend/ui/storageKeys.ts` ile sabitlendi. `modules/*` altındaki JS paketleri için `.d.ts` bildirimleri eklendi (`core.state`, `core.moduleLoader`, `Companies`, `Settings`, `library`), böylece TypeScript tüketimi güvence altına alındı. IAM seed veri kümeleri `src/data/iamTypes.ts` + `src/data/index.ts` ile merkezileştirildi ve sayfalarda kullanımları güncellendi. `npm run verify` lint/typecheck/test zincirinin yeşil kalması için her blok sonrasında çalıştırılıyor.
- **GitHub Actions**:
  - `codespaces-prebuild.yml`: bağımlılık kurulumu + lint + typecheck + unit test (`npm run verify`).
  - `rc-verify.yml`: manuel veya `rc/*` branch push’larında `npm run verify:rc` çağrısı ile Lighthouse & Playwright raporları üretir.
- **Dokümantasyon**: `docs/codespaces-usage.md`, `docs/lighthouse.md`, `PROJECT_STATUS.md` ve `terminal-notes.md` otomatik süreçleri referans gösteriyor.
- **Notlar**: `notlar/openai-setup.md`, `notlar/lighthouse-plan.md` ve bu dosya, otomasyonla ilgili yapılacakları hızlı erişime taşıyor.

> Güncelleme: Yeni bir otomasyon eklendiğinde bu dosyaya kısa bir madde ekleyin.
