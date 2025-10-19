# Library Docs

Bu klasör, kütüphaneye ait bileşenlerin kullanım örneklerini ve teknik yönergeleri barındırmak için ayrıldı. Şu an iki katman var:

- Markdown rehberleri (`phone-input.md` vb.)
- `demo/` klasörü: bileşenleri canlı test etmek için hazırlanmış küçük HTML sayfaları (`demo/index.html` telefon bileşenini gösterir).

Demo sayfasını açmak için proje kökünden basit bir HTTP sunucu başlatabilirsin:

```bash
npx http-server modules/library/docs/demo
# veya
npm run library:demo
```

Sonraki adımda Storybook/Vite tabanlı kapsamlı bir dokümantasyon sitesi hazırlamak hedefleniyor.
