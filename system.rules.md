# TAXIPartner System Rules

## ✅ Rule Governance

- Assistant may never create or modify meta-level files (e.g. rules, config, docs) without explicit permission.
- If the assistant believes a rule update is necessary, it may propose changes to the user. Only after approval, those changes can be applied.


## 🔄 Communication & Language

- All communication between developer and assistant is in **Turkish**.
- All system code must be written in **English**.
- Default UI language of the system is **German (de-AT)**.
- All projects are assumed to run under **VSCode Live Server**.
- Before any file is edited, assistant must explicitly ask: “Beni şu dosyaya bağla”.

## 🧱 UI / Layout Structure

- Header is always fixed (`position: fixed`) with `h-14`, `z-[999]`.
- All content (sidebar + main) starts **after** header: use `mt-14`.
- Sidebar starts closed by default (`-translate-x-full`).
- Sidebar toggles via ☰ button and shifts `#modulContent` via `ml-72`.
- Clicking outside sidebar closes it automatically.
- Clicking a sidebar menu item also closes sidebar.

## 📁 Module & Data Architecture

- User data is stored in: `/modules/core.user/user.data.module.js`
- Each module lives in its own folder:
  - `/modules/ReleaseManagement/index.module.js`
  - `/modules/UserManagement/index.module.js`
- Modules must export default object with `init(target)` method.
- Module switching is handled by dynamic `import()` or `ModuleLoader.load()`.


## 🔐 Geriye Dönük Uyum & Sistem Bütünlüğü Koruma Protokolü (GDUSP)

- Bu bölüm sistem bütünlüğünü mutlak koruma altına alan disipliner kural setini temsil eder.
- Sistemdeki son çalışma çıktısına (UI + konsol + layout) **Uygun değilse işlem derhal BASLATILMAZ.**
- Örnek bilgilendirmelerde dosya isimleri sistemdeki tam yollarıyla yazılır (örnek: `Kök klasör/system.rules.md`).

## 📱 Mobile Responsiveness - KATI KURAL

- Tüm UI bileşenleri, layout yapıları ve etkileşim sistemleri **mobil uyumluluk** dikkate alınarak geliştirilmelidir.
- Mobil cihazlarda overflow, hizalama, kayma ve görünmezlik gibi tüm durumlar test edilmeli, mobil simülatör veya gerçek cihazda kontrol edilmelidir.
- Tailwind breakpoint sınıfları (`md:`, `lg:`) ve `window.innerWidth` gibi kontroller responsive davranış için zorunludur.
- Bu standart **tüm sistem modülleri için geçerlidir** ve ihlal edilemez.

## 🚫 Kural İhlali ve Sorumluluk - KATI KURAL

- Assistant, kullanıcı açıkça “beni şu dosyaya bağla” demedikçe hiçbir dosyada işlem yapamaz.
- Kullanıcının onayı olmadan yapılan her işlem **kural ihlalidir** ve sorumluluğu assistanta aittir.
- İhlal edilmiş bir işlem tespit edilirse, sistem otomatik olarak önceki versiyona dönmeli ya da kullanıcıya açık şekilde bildirilmelidir.

## 📂 Dosya İşlem Disiplini - KATI KURAL

- Assistant herhangi bir dosyaya işlem yapmadan önce o dosyanın içeriğini satır satır analiz etmelidir.
- Dosyada daha önce yazılmış tüm bölümler korunmalı, üzerine yazma veya silme yapılamaz.
- Yeni bir bölüm eklenecekse yalnızca sona veya belirtilen yere eklenmelidir.
- Tüm dosya müdahaleleri dikkatli şekilde ve bütünlük korunarak yapılmalıdır.

## 📊 Table Rendering & Overflow Behavior - STANDART KURAL

- Tüm `<table>` öğeleri, bir `div.overflow-x-auto` kapsayıcısı içinde yer almalıdır.
- Tablo genişliği `min-w-full` ile tanımlanmalı, ancak taşma durumunda yalnızca tablo scroll edilebilmelidir.
- Sayfa dışına taşmayı önlemek için `main#modulContent` elementine `overflow-x-hidden` sınıfı verilmelidir.
- Bu kural sistemdeki tüm modüller için geçerlidir ve responsive (mobil) davranışı koruma altına alır.
