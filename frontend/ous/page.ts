import { listOUs, createOU, updateOU, deleteOU } from "./api";
import { t } from "../i18n/index";
import { showModal, closeModal } from "../ui/modal";
import { showError } from "../ui/error";

export async function mountOUsPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'ous', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('ous')) return;
    attr.push('ous');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }
  const savedTid = localStorage.getItem('tp_tenantId') || '';
  root.innerHTML = `
    <div style="padding:16px;font-family:ui-sans-serif">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:8px">${t('ou') ?? 'Organization Units'}</h2>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="ou-tenant" class="input" style="width:260px" placeholder="${t('tenantId') ?? 'tenantId'}" value="${savedTid}">
        <button id="ou-reload" class="btn">${t('reload') ?? 'Reload'}</button>
        <input id="ou-search" class="input" style="flex:1" placeholder="${t('search') ?? 'Search'}">
      </div>
      <div style="display:grid;grid-template-columns:340px 1fr;gap:16px">
        <div id="ou-tree" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;max-height:70vh;overflow:auto;padding:8px"></div>
        <div id="ou-form" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px">
          <h3 style="font-weight:600;margin-bottom:8px">${t('create') ?? 'Create'}</h3>
          <div class="small">${t('legalName') ?? 'name'}</div>
          <input id="ou-name" class="input" placeholder="${t('legalName') ?? 'name'}">
          <div class="small" style="margin-top:8px">${t('parent') ?? 'Parent'}</div>
          <select id="ou-parent" class="input"></select>
          <div style="margin-top:12px"><button id="ou-create" class="btn">${t('create') ?? 'Create'}</button></div>
        </div>
      </div>
    </div>
  `;

  const tenantInput = document.getElementById("ou-tenant") as HTMLInputElement;
  const treeEl = document.getElementById("ou-tree") as HTMLDivElement;
  const createBtn = document.getElementById("ou-create") as HTMLButtonElement;
  const reloadBtn = document.getElementById("ou-reload") as HTMLButtonElement;
  const searchInput = document.getElementById("ou-search") as HTMLInputElement;
  const parentSelect = document.getElementById("ou-parent") as HTMLSelectElement;
  let currentTenantId = savedTid;
  let cachedItems: any[] = [];

  function ensureSpinnerStyle() {
    if (document.getElementById('tp-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'tp-spinner-style';
    style.textContent = '.spinner{display:inline-block;width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#4b5563;border-radius:9999px;animation:tpSpin .8s linear infinite;vertical-align:middle}@keyframes tpSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  ensureSpinnerStyle();

  const spinnerHtml = '<span class="spinner" aria-label="loading"></span>';

  const renderLoadError = (error: unknown) => {
    console.error(error);
    const message = t('ouListFailed') ?? t('errorGeneric') ?? 'Failed to fetch list';
    showError(message);
    treeEl.innerHTML = `<div class="empty">${message}</div>`;
  };

  const triggerLoad = (reuse = false) => {
    load({ reuse }).catch(renderLoadError);
  };

  reloadBtn.addEventListener('click', () => triggerLoad(false));
  searchInput.addEventListener('input', () => triggerLoad(true));

  createBtn.addEventListener('click', async () => {
    const tenantId = tenantInput.value.trim();
    const name = (document.getElementById("ou-name") as HTMLInputElement).value.trim();
    const parentId = parentSelect.value || null;
    if (!tenantId) {
      treeEl.innerHTML = `(${t('tenantIdRequired') ?? 'Tenant ID required'})`;
      return;
    }
    if (!name) {
      showError(t('legalNameRequired') ?? 'Name required');
      return;
    }
    const response = await createOU(tenantId, { name, parentId });
    if (!response.ok) {
      showError(response.error || t('errorGeneric') || 'Error');
      return;
    }
    (document.getElementById("ou-name") as HTMLInputElement).value = '';
    parentSelect.value = '';
    try {
      await load();
    } catch (error) {
      renderLoadError(error);
    }
  });

  async function load(options: { reuse?: boolean } = {}) {
    const tenantId = tenantInput.value.trim();
    if (!tenantId) {
      treeEl.innerHTML = `(${t('tenantIdRequired') ?? 'Tenant ID required'})`;
      cachedItems = [];
      currentTenantId = '';
      return;
    }
    const reuse = options.reuse && cachedItems.length && tenantId === currentTenantId;
    localStorage.setItem("tp_tenantId", tenantId);
    if (tenantId !== currentTenantId) {
      currentTenantId = tenantId;
      cachedItems = [];
    }
    if (!reuse) {
      const response = await listOUs(tenantId);
      if (!response.ok) {
        throw new Error(response.error || t('ouListFailed') || 'Failed to fetch list');
      }
      cachedItems = response.items || [];
    }
    const items = cachedItems;

    const byId = new Map(items.map((item: any) => [item.id, item]));
    const depthCache = new Map<string, number>();
    function depth(item: any): number {
      if (depthCache.has(item.id)) return depthCache.get(item.id)!;
      const parent = item.parentId ? byId.get(item.parentId) : null;
      const value = parent ? depth(parent) + 1 : 0;
      depthCache.set(item.id, value);
      return value;
    }
    items.forEach(depth);

    const query = searchInput.value.trim().toLowerCase();
    const filtered = items.filter((item: any) => (item.name || '').toLowerCase().includes(query));

    const byParent = new Map<string | null, any[]>();
    for (const item of items) {
      const key = item.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(item);
    }

    const renderTree = (parentId: string | null): string => {
      const nodes = byParent.get(parentId) || [];
      return nodes
        .map((node) => {
          const match = filtered.includes(node);
          const children = renderTree(node.id);
          const hasChildMatch = children.trim() !== '';
          if (query && !match && !hasChildMatch) return '';
          return `
            <div style="padding-left:${depth(node) * 12}px;padding:4px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
              <span>${node.name}</span>
              <span>
                <button data-edit="${node.id}" style="margin-right:4px;font-size:12px">${t('edit') ?? 'Edit'}</button>
                <button data-del="${node.id}" style="font-size:12px;color:#b91c1c">${t('delete') ?? 'Delete'}</button>
              </span>
            </div>
            ${children}
          `;
        })
        .join('');
    };

    const treeMarkup = renderTree(null);

    treeEl.innerHTML = treeMarkup || `(${t('noRecords') ?? 'No records'})`;

    treeEl.querySelectorAll<HTMLButtonElement>('button[data-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.edit!;
        const node = items.find((item: any) => item.id === id);
        const currentName = node?.name || '';
        const newName = prompt(t('editNamePrompt') ?? 'New name?', currentName);
        const trimmed = (newName ?? '').trim();
        if (!trimmed || trimmed === currentName) return;
        const response = await updateOU(tenantId, id, { name: trimmed });
        if (!response.ok) {
          alert(response.error || t('errorGeneric') || 'Error');
          return;
        }
        try {
          await load();
        } catch (error) {
          renderLoadError(error);
        }
      });
    });

    treeEl.querySelectorAll<HTMLButtonElement>('button[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del!;
        if (!confirm(t('confirmDelete') ?? 'Delete this entry?')) return;
        const response = await deleteOU(tenantId, id);
        if (!response.ok) {
          const raw = String(response?.error || '');
          const message = raw.match(/Alt birimler|children/i) ? (t('cannotDeleteWithChildren') || raw) : (t('errorGeneric') || raw);
          alert(message);
          return;
        }
        try {
          await load();
        } catch (error) {
          renderLoadError(error);
        }
      });
    });

    parentSelect.innerHTML = '<option value="">—</option>' +
      items
        .map((item: any) => {
          const indent = '&nbsp;&nbsp;'.repeat(depth(item));
          return `<option value="${item.id}">${indent}${item.name}</option>`;
        })
        .join('');
  }

  triggerLoad(false);
}
