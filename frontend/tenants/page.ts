import { listTenants, createTenant, assignTenantUser } from "./api";
import { t } from "../i18n/index";
import { showError, requireFields } from "../ui/error";

type TenantItem = {
  id: string;
  code: string;
  name: string;
};

export async function mountTenantsPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'tenants', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('tenants')) return;
    attr.push('tenants');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }
  root.innerHTML = `
    <div style="padding:16px;font-family:ui-sans-serif;max-width:720px">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(t('tenantsTitle'))}</h2>
      <section style="margin-bottom:24px">
        <div style="font-weight:600;margin-bottom:8px">${esc(t('createTenant'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <input id="tenant-code" style="flex:1;min-width:160px;padding:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="${esc(t('tenantCodePlaceholder'))}" />
          <input id="tenant-name" style="flex:1;min-width:200px;padding:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="${esc(t('tenantNamePlaceholder'))}" />
          <button id="tenant-create" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#0ea5e9;color:#fff">${esc(t('createTenant'))}</button>
        </div>
        <div id="tenant-feedback" style="font-size:13px;color:#059669"></div>
      </section>
      <section style="margin-bottom:24px">
        <div style="font-weight:600;margin-bottom:8px">${esc(t('assignUser'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <input id="assign-tenant" style="flex:1;min-width:160px;padding:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="${esc(t('tenantIdPlaceholder'))}" />
          <input id="assign-user" style="flex:1;min-width:160px;padding:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="${esc(t('userIdPlaceholder'))}" />
          <input id="assign-role" style="flex:1;min-width:160px;padding:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="${esc(t('rolePlaceholder'))}" />
          <button id="assign-submit" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#6366f1;color:#fff">${esc(t('assignAction'))}</button>
        </div>
        <div id="assign-feedback" style="font-size:13px;color:#059669"></div>
      </section>
      <section>
        <div style="font-weight:600;margin-bottom:8px">${esc(t('tenantListTitle'))}</div>
        <div id="tenant-list" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;min-height:48px"></div>
      </section>
    </div>
  `;

  const codeInput = byId<HTMLInputElement>(root, 'tenant-code');
  const nameInput = byId<HTMLInputElement>(root, 'tenant-name');
  const createBtn = byId<HTMLButtonElement>(root, 'tenant-create');
  const tenantFeedback = byId<HTMLDivElement>(root, 'tenant-feedback');
  const listEl = byId<HTMLDivElement>(root, 'tenant-list');
  const assignTenantInput = byId<HTMLInputElement>(root, 'assign-tenant');
  const assignUserInput = byId<HTMLInputElement>(root, 'assign-user');
  const assignRoleInput = byId<HTMLInputElement>(root, 'assign-role');
  const assignBtn = byId<HTMLButtonElement>(root, 'assign-submit');
  const assignFeedback = byId<HTMLDivElement>(root, 'assign-feedback');

  createBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    if (!requireFields([
      { value: code, message: t('tenantCodeRequired') },
      { value: name, message: t('tenantNameRequired') }
    ])) {
      return;
    }
    createBtn.disabled = true;
    tenantFeedback.textContent = '';
    try {
      const response = await createTenant({ code, name });
      if (!response.ok) {
        showError(response.error || t('errorGeneric'));
        return;
      }
      codeInput.value = '';
      nameInput.value = '';
      tenantFeedback.textContent = t('tenantCreated');
      await load();
    } catch (error) {
      showError(String(error));
    } finally {
      createBtn.disabled = false;
    }
  });

  assignBtn.addEventListener('click', async () => {
    const tenantId = assignTenantInput.value.trim();
    const userId = assignUserInput.value.trim();
    const role = assignRoleInput.value.trim() || undefined;
    if (!requireFields([
      { value: tenantId, message: t('tenantIdRequired') },
      { value: userId, message: t('userIdRequired') }
    ])) {
      return;
    }
    assignBtn.disabled = true;
    assignFeedback.textContent = '';
    try {
      const response = await assignTenantUser(tenantId, { userId, role });
      if (!response.ok) {
        showError(response.error || t('errorGeneric'));
        return;
      }
      assignFeedback.textContent = t('tenantAssignSuccess');
    } catch (error) {
      showError(String(error));
    } finally {
      assignBtn.disabled = false;
    }
  });

  async function load() {
    listEl.innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
    try {
      const response = await listTenants('');
      if (!response.ok) {
        const message = response.error || t('loadFailed');
        showError(message);
        listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      const items: TenantItem[] = response.items || [];
      if (!items.length) {
        listEl.innerHTML = `<div class="empty">${esc(t('noRecords'))}</div>`;
        return;
      }
      listEl.innerHTML = items
        .map((item) => `
          <div style="padding:8px 0;border-bottom:1px solid #f1f5f9">
            <div style="font-weight:600">${esc(item.name)}</div>
            <div style="font-size:13px;color:#475569">${esc(t('tenantCodeLabel'))}: ${esc(item.code)}</div>
          </div>
        `)
        .join('');
    } catch (error) {
      showError(String(error));
      listEl.innerHTML = `<div class="empty">${esc(t('loadFailed'))}</div>`;
    }
  }

  load().catch((error) => showError(String(error)));
}

function byId<T extends HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${id}`);
  if (!el) {
    throw new Error(`Element not found: #${id}`);
  }
  return el as T;
}

function esc(value: string | number | null | undefined): string {
  const str = value ?? '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
