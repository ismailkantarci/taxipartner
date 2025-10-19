const resultBox = document.getElementById("result");
const assignBtn = document.getElementById("assignBtn");

async function loadRoles() {
  const sel = document.getElementById("roleSelect");
  sel.innerHTML = "";
  try {
    const res = await fetch("/seed/roles");
    if (!res.ok) throw new Error(`Roller alınamadı: ${res.status}`);
    const data = await res.json();
    (data.roles || []).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.name;
      opt.textContent = `${r.name} (${r.scope})`;
      sel.appendChild(opt);
    });
  } catch (error) {
    resultBox.textContent = JSON.stringify({ ok: false, error: error.message }, null, 2);
  }
}

async function assignRole(event) {
  event.preventDefault();
  const userId = document.getElementById("userId").value.trim();
  const role = document.getElementById("roleSelect").value;

  if (!userId || !role) {
    resultBox.textContent = JSON.stringify({ ok: false, error: "Kullanıcı ve rol alanları zorunlu." }, null, 2);
    return;
  }

  try {
    assignBtn.disabled = true;
    assignBtn.textContent = "Gönderiliyor…";

    const res = await fetch("/api/assign-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, role }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `İstek hata döndürdü (${res.status})`);
    }

    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    resultBox.textContent = JSON.stringify({ ok: false, error: error.message }, null, 2);
  } finally {
    assignBtn.disabled = false;
    assignBtn.textContent = "Rol Ata";
  }
}

assignBtn.addEventListener("click", assignRole);
loadRoles();
