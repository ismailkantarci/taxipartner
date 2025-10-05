import './page.css';
import { listTemplates, roleEffective, updateTemplate } from './api';

const DEV_ENABLED = import.meta.env.MODE !== 'production';

type TemplateEntry = { role: string; allow: string[]; deny: string[] };

type State = {
  roles: string[];
  perms: string[];
  effective: Record<string, Set<string>>;
  templates: Map<string, TemplateEntry>;
  selectedRole: string;
  editAllow: string[];
};

export function mountPermissionsPage(root: HTMLElement) {
  root.innerHTML = '';

  const wrap = el('div', 'wrap');
  const toolbar = el('div', 'toolbar');
  toolbar.innerHTML = `
    <div style="font-weight:700">Permissions Matrix</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="permFilter" class="input" placeholder="Permission filtrele…" />
      <input id="roleFilter" class="input" placeholder="Rol filtrele…" />
      <button id="btnCsv" class="btn">CSV dışa aktar</button>
    </div>
  `;

  const tableWrap = el('div');
  const info = el('div', 'small', 'Yükleniyor…');

  wrap.append(toolbar, tableWrap, info);

  let devPanel: HTMLElement | null = null;
  let allowContainer: HTMLElement | null = null;
  let addInput: HTMLInputElement | null = null;
  let toast: HTMLElement | null = null;
  let roleSelect: HTMLSelectElement | null = null;

  if (DEV_ENABLED) {
    devPanel = el('div', 'panel');
    devPanel.innerHTML = `
      <h3>Dev Düzenleyici</h3>
      <div class="row" style="margin-bottom:8px">
        <select id="editRole" class="input" style="max-width:240px"></select>
      </div>
      <div class="small" style="margin-bottom:6px">Allow (tıklayarak kaldır)</div>
      <div id="allowChips" class="row" style="margin-bottom:8px"></div>
      <div class="row" style="margin-bottom:8px">
        <input id="newPermission" class="input" placeholder="Yeni izin (örn. tp.identity.read)" />
        <button id="btnAddPerm" class="btn">Ekle</button>
      </div>
      <div class="row">
        <button id="btnSave" class="btn primary">Kaydet</button>
      </div>
      <div id="devToast" class="toast"></div>
    `;
    wrap.append(devPanel);

    allowContainer = devPanel.querySelector('#allowChips') as HTMLElement;
    addInput = devPanel.querySelector('#newPermission') as HTMLInputElement;
    toast = devPanel.querySelector('#devToast') as HTMLElement;
    roleSelect = devPanel.querySelector('#editRole') as HTMLSelectElement;
  }

  root.append(wrap);

  const permFilter = toolbar.querySelector('#permFilter') as HTMLInputElement;
  const roleFilter = toolbar.querySelector('#roleFilter') as HTMLInputElement;
  const csvButton = toolbar.querySelector('#btnCsv') as HTMLButtonElement;

  const state: State = {
    roles: [],
    perms: [],
    effective: {},
    templates: new Map(),
    selectedRole: '',
    editAllow: []
  };

  void bootstrap();

  async function bootstrap() {
    try {
      info.textContent = 'Şablonlar getiriliyor…';
      const templatesResp = await listTemplates();
      if (!templatesResp.ok) {
        info.textContent = templatesResp.error ?? 'Şablonlar alınamadı.';
        return;
      }

      templatesResp.templates.forEach((tpl) => {
        state.templates.set(tpl.role, { ...tpl });
      });

      state.roles = templatesResp.templates.map((tpl) => tpl.role);
      state.selectedRole = state.roles[0] ?? '';

      info.textContent = 'İzinler çözümleniyor…';
      for (const role of state.roles) {
        const effectiveResp = await roleEffective(role);
        if (!effectiveResp.ok) {
          info.textContent = effectiveResp.error ?? `${role} için izin çözümlenemedi.`;
          return;
        }
        state.effective[role] = new Set(effectiveResp.allow ?? []);
      }

      rebuildPermList();
      state.editAllow = getTemplateAllow(state.selectedRole);
      render();
    } catch (error) {
      info.textContent = error instanceof Error ? error.message : 'Veri getirilemedi.';
    }
  }

  function rebuildPermList() {
    const all = new Set<string>();
    Object.values(state.effective).forEach((set) => {
      set.forEach((perm) => all.add(perm));
    });
    state.perms = Array.from(all).sort((a, b) => a.localeCompare(b));
  }

  function render() {
    renderMatrix();
    if (DEV_ENABLED) {
      renderDevPanel();
    }
  }

  function renderMatrix() {
    const permQuery = permFilter.value.trim().toLowerCase();
    const roleQuery = roleFilter.value.trim().toLowerCase();

    const roles = state.roles.filter((role) => role.toLowerCase().includes(roleQuery));
    const perms = state.perms.filter((perm) => perm.toLowerCase().includes(permQuery));

    const table = el('table', 'table');
    const thead = el('thead');
    const headerRow = el('tr');
    headerRow.append(th('Permission', 'sticky'));
    roles.forEach((role) => headerRow.append(th(role)));
    thead.append(headerRow);
    table.append(thead);

    const tbody = el('tbody');
    perms.forEach((perm) => {
      const row = el('tr');
      row.append(td(perm, 'sticky'));
      roles.forEach((role) => {
        const mark = state.effective[role]?.has(perm) ? '✓' : '';
        row.append(td(mark));
      });
      tbody.append(row);
    });
    table.append(tbody);

    tableWrap.innerHTML = '';
    tableWrap.append(table);
    info.textContent = `${perms.length} izin • ${roles.length} rol`;

    csvButton.onclick = () => exportCsv(perms, roles);
  }

  function renderDevPanel() {
    if (!devPanel || !allowContainer || !addInput || !toast || !roleSelect) {
      return;
    }

    roleSelect.innerHTML = state.roles
      .map((role) => `<option value="${role}">${role}</option>`)
      .join('');
    roleSelect.value = state.selectedRole;

    allowContainer.innerHTML = '';
    if (state.editAllow.length === 0) {
      allowContainer.append(el('span', 'small', 'İzin yok'));
    } else {
      state.editAllow.forEach((perm) => {
        const chip = el('span', 'badge dev', perm);
        chip.title = 'Kaldır';
        chip.onclick = () => {
          state.editAllow = state.editAllow.filter((entry) => entry !== perm);
          render();
        };
        allowContainer.append(chip);
      });
    }

    const handleRoleChange = () => {
      state.selectedRole = roleSelect!.value;
      state.editAllow = getTemplateAllow(state.selectedRole);
      clearToast();
      render();
    };

    roleSelect.onchange = handleRoleChange;

    const addButton = devPanel.querySelector('#btnAddPerm') as HTMLButtonElement;
    addButton.onclick = () => {
      const value = (addInput!.value || '').trim();
      if (!value) {
        showToast('İzin değeri boş olamaz.', 'error');
        return;
      }
      if (state.editAllow.includes(value)) {
        showToast('Bu izin zaten mevcut.', 'error');
        return;
      }
      state.editAllow = [...state.editAllow, value];
      addInput!.value = '';
      showToast(`İzin eklendi: ${value}`, 'success', true);
      render();
    };

    const saveButton = devPanel.querySelector('#btnSave') as HTMLButtonElement;
    saveButton.onclick = async () => {
      if (!state.selectedRole) {
        showToast('Rol seçilmedi.', 'error');
        return;
      }
      saveButton.disabled = true;
      addButton.disabled = true;
      showToast('Kaydediliyor…', 'info', true);
      try {
        const tpl = state.templates.get(state.selectedRole);
        const deny = tpl?.deny ?? [];
        const response = await updateTemplate(state.selectedRole, {
          allow: state.editAllow,
          deny
        });
        if (!response.ok || !response.template) {
          showToast(response.error ?? 'Kaydedilemedi.', 'error');
          return;
        }
        state.templates.set(state.selectedRole, { ...response.template });
        const effectiveResp = await roleEffective(state.selectedRole);
        if (effectiveResp.ok) {
          state.effective[state.selectedRole] = new Set(effectiveResp.allow ?? []);
          rebuildPermList();
        }
        showToast(response.note ?? 'Güncellendi.', 'success');
        renderMatrix();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Kaydetme hatası.', 'error');
      } finally {
        saveButton.disabled = false;
        addButton.disabled = false;
      }
    };
  }

  function getTemplateAllow(role: string): string[] {
    const entry = state.templates.get(role);
    if (!entry) {
      return [];
    }
    return [...entry.allow].sort((a, b) => a.localeCompare(b));
  }

  function exportCsv(perms: string[], roles: string[]) {
    const rows: string[][] = [['permission', ...roles]];
    perms.forEach((perm) => {
      const line = [perm, ...roles.map((role) => (state.effective[role]?.has(perm) ? '1' : '0'))];
      rows.push(line);
    });
    const csv = rows.map((line) => line.map((cell) => escapeCsv(cell)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'permissions_matrix.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function escapeCsv(value: string): string {
    const needsQuotes = /[",\n]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  }

  function showToast(message: string, tone: 'error' | 'success' | 'info', keep = false) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.className = 'toast';
    toast.style.display = 'block';
    if (tone === 'error') {
      toast.classList.add('error');
    } else if (tone === 'success') {
      toast.classList.add('success');
    } else {
      toast.style.display = 'block';
    }
    if (!keep && tone !== 'error') {
      setTimeout(() => clearToast(), 2500);
    }
  }

  function clearToast() {
    if (!toast) {
      return;
    }
    toast.textContent = '';
    toast.className = 'toast';
    toast.style.display = 'none';
  }

  permFilter.addEventListener('input', () => renderMatrix());
  roleFilter.addEventListener('input', () => renderMatrix());
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

function th(text: string, className?: string) {
  const element = document.createElement('th');
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function td(text: string, className?: string) {
  const element = document.createElement('td');
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}
