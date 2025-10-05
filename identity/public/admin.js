async function loadRoles() {
  const sel = document.getElementById("roleSelect");
  sel.innerHTML = "";
  const res = await fetch("/seed/roles");
  const data = await res.json();
  (data.roles || []).forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = r.name + " (" + r.scope + ")";
    sel.appendChild(opt);
  });
}

async function assignRole() {
  const userId = document.getElementById("userId").value.trim();
  const role = document.getElementById("roleSelect").value;
  const res = await fetch("/assign-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role })
  });
  const data = await res.json();
  document.getElementById("result").textContent = JSON.stringify(data, null, 2);
}

document.getElementById("assignBtn").addEventListener("click", assignRole);
loadRoles();
