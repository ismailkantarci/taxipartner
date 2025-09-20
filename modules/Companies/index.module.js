// Companies Module – MEGA ULTRA (list + full table, tiny create, detail page, CRUD, CSV)
// No CSS import here. Styles are loaded via manifest (index.css)

export default {
// Basit placeholder - detaylı içerik buraya eklenecek
  init(target){
    target.innerHTML = `
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Şirketler</h1>
        <p class="text-gray-600 mb-4">Bu modül, tüm şirketlerinizi yönetmenizi sağlar.</p>
        <button id="cmp-new" class="px-4 py-2 bg-black text-white rounded">Yeni Şirket</button>
        <div id="companies-list" class="mt-4 text-sm text-gray-700">Henüz kayıt yok.</div>
      </div>`;
  }
};
