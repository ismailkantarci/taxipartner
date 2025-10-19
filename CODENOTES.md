# Dev Notları (2025-05-09)

- Codespaces’te Identity backend’i (`npm --prefix identity run dev`) başlamadan login denemesi 502/Fetch hatası verir.
- Identity için Prisma SQLite yolu mutlak olmalı (`.env` ve `identity/.env` -> `file:/workspaces/taxipartner/prisma/identity/dev.db`).
- Chrome konsolundaki `chrome-extension://…` hataları tarayıcı eklentisi kaynaklı; uygulama ile ilgili değil.
- Header’daki logout Identity API’ye `/auth/logout` çağırır; özel yönlendirme gerekiyorsa `VITE_IDENTITY_LOGIN` ile login URL’sini ezebilirsin (varsayılan: API hostundan 5174 SPA adresi türetilir).
- Nihai senaryoda Identity SPA login sonrası Admin UI’ye dönmeli; bunun için ileride `VITE_ADMIN_URL` benzeri bir bayrakla 5173’e redirect planlanmalı (şimdilik kullanıcı login sonrası admin sekmesine manuel geçiyor).
- Admin UI token yoksa kullanıcıyı Identity’ye yönlendirecek “guard” eksik; router init’te `/auth/me` çağırıp 401/unauthenticated durumunda `VITE_IDENTITY_LOGIN` adresine redirect edecek kontrol eklenmeli.
- Identity login formu başarılı olduktan sonra (token alındığında) `localStorage`a admin hedefini yazıp Admin UI’ye yönlenecek `state` parametresi (örn. `?next=`) desteklenmeli; iki aşamalı yönlendirmeyi basitleştirir.
- Codespaces’te servisleri başlatırken varsayılan çözüm `npm run codespaces:start`; kullanıcıya her zaman tek komut öner, gerekirse diğer komutları bu komutun arkasına bağla.
- Tailwind “content option missing” uyarısı root’tan çalışan watcher’dan geliyor; prod hazırlığında tailwind config içeriğini gözden geçir veya uyarıyı bastırmak için uygun `content` dizelerini ekle.
- `frontend/i18n/index.ts` çeviri dosyasında `status` ve `userId` anahtarları aynı dil bloğunda iki kez tanımlı; build uyarı veriyor. İleride çeviri sözlüğünü sadeleştirirken bu mükerrerleri temizle.
- Sol nav’daki `/tenants/shareholders` çalışma alanı tenant filtresi + özet metriklerle gerçek hissedar verisini gösterir; Tenants detayındaki Shareholdings sekmesindeki CTA doğrudan buraya yönlendirir.
