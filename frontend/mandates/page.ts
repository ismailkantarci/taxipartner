import {
  listMandates,
  createMandate,
  updateMandate,
  deleteMandate,
  getMandate
} from './api';
import { listOrganizations } from '../organizations/api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import { getActiveTenantId } from '../ui/activeTenant';
import { requireElement } from '../ui/dom';
import { STORAGE_KEY_ACTIVE_TENANT } from '../ui/storageKeys';

type MandateListItem = {
  id: string;
  title: string;
  mandateType: string;
  status: string;
  validFrom?: string | null;
  validTo?: string | null;
  organization?: { id: string; name: string } | null;
  companyId?: string | null;
  updatedAt?: string;
};

type MandateDetail = MandateListItem & {
  notes?: string | null;
  metaJson?: string | null;
  createdAt?: string;
};

type ListResponse = {
  ok: boolean;
  items?: MandateListItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string | null;
  order?: string | null;
  error?: string;
  errorCode?: string;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
  errorCode?: string;
};

type DetailResponse = {
  ok: boolean;
  mandate?: MandateDetail;
  error?: string;
  errorCode?: string;
};

type ListState = {
  query: string;
  status: string;
  organizationId: string;
  page: number;
  pageSize: number;
  total: number;
  sort: string;
  order: 'asc' | 'desc';
};

type OrganizationOption = {
  id: string;
  name: string;
};

const STORAGE_KEY_STATE = 'tp_mandates_state';
const DEFAULT_PAGE_SIZE = 20;
const STATUS_OPTIONS = ['All', 'Draft', 'Active', 'Ruhend', 'Gelöscht'];
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'updated', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'validfrom', label: 'Valid from' },
  { value: 'validto', label: 'Valid to' }
];

const MANDATE_ERROR_I18N: Record<string, string> = {
  TENANT_ID_REQUIRED: 'mandates.error.tenantRequired',
  MANDATE_TITLE_REQUIRED: 'mandates.error.titleRequired',
  MANDATE_TYPE_REQUIRED: 'mandates.error.typeRequired',
  MANDATE_ORG_INVALID: 'mandates.error.organizationInvalid',
  MANDATE_COMPANY_INVALID: 'mandates.error.companyInvalid',
  MANDATE_NOT_FOUND: 'mandates.error.notFound'
};

function mandateErrorMessage(code?: string, fallback?: string) {
  if (code) {
    const key = MANDATE_ERROR_I18N[code];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
  }
  return fallback || t('errorGeneric') || 'Error';
}

export async function mountMandatesPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'mandates', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('mandates')) return;
    attr.push('mandates');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }

  const tenantId = getActiveTenantId();
  if (!tenantId) {
    root.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Önce tenant seçin')}</div>`;
    return;
  }

  root.innerHTML = getShell();

  const tenantInput = requireElement<HTMLInputElement>(root, '#mandate-tenant');
  tenantInput.value = tenantId;
  tenantInput.readOnly = true;
  tenantInput.style.cursor = 'not-allowed';
  tenantInput.style.backgroundColor = 'rgba(241,245,249,0.6)';
  tenantInput.title = t('tenantLockedHint') || 'Tenant seçimi üstten yapılır';

  const searchInput = requireElement<HTMLInputElement>(root, '#mandate-search');
  const statusSelect = requireElement<HTMLSelectElement>(root, '#mandate-status');
  const organizationSelect = requireElement<HTMLSelectElement>(root, '#mandate-organization-filter');
  const sortSelect = requireElement<HTMLSelectElement>(root, '#mandate-sort');
  const orderToggle = requireElement<HTMLButtonElement>(root, '#mandate-order-toggle');
  const refreshBtn = requireElement<HTMLButtonElement>(root, '[data-action="refresh"]');
  const listEl = requireElement<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = requireElement<HTMLDivElement>(root, '[data-role="detail"]');
  const paginationInfo = requireElement<HTMLSpanElement>(root, '#mandate-pagination-info');
  const prevBtn = requireElement<HTMLButtonElement>(root, '#mandate-page-prev');
  const nextBtn = requireElement<HTMLButtonElement>(root, '#mandate-page-next');

  const createForm = requireElement<HTMLFormElement>(root, '#mandate-create-form');
  const createTitleInput = requireElement<HTMLInputElement>(createForm, '#mandate-create-title');
  const createTypeInput = requireElement<HTMLInputElement>(createForm, '#mandate-create-type');
  const createStatusSelect = requireElement<HTMLSelectElement>(createForm, '#mandate-create-status');
  const createOrgSelect = requireElement<HTMLSelectElement>(createForm, '#mandate-create-organization');
  const createCompanyInput = requireElement<HTMLInputElement>(createForm, '#mandate-create-company');
  const createValidFromInput = requireElement<HTMLInputElement>(createForm, '#mandate-create-valid-from');
  const createValidToInput = requireElement<HTMLInputElement>(createForm, '#mandate-create-valid-to');
  const createNotesInput = requireElement<HTMLTextAreaElement>(createForm, '#mandate-create-notes');
  const createMetaInput = requireElement<HTMLTextAreaElement>(createForm, '#mandate-create-meta');
  const createBtn = requireElement<HTMLButtonElement>(createForm, '[data-action="create"]');

  const listState: ListState = {
    query: '',
    status: 'All',
    organizationId: '',
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    sort: 'updated',
    order: 'desc'
  };

  let organizations: OrganizationOption[] = [];
  const selection = { id: null as string | null };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_STATE) || 'null') as
      | {
          query?: string;
          status?: string;
          organizationId?: string;
          page?: number;
          sort?: string;
          order?: 'asc' | 'desc';
        }
      | null;
    if (saved) {
      if (typeof saved.query === 'string') listState.query = saved.query;
      if (typeof saved.status === 'string') listState.status = saved.status;
      if (typeof saved.organizationId === 'string') listState.organizationId = saved.organizationId;
      if (typeof saved.page === 'number' && saved.page >= 0) listState.page = saved.page;
      if (typeof saved.sort === 'string') listState.sort = saved.sort;
      if (saved.order === 'asc' || saved.order === 'desc') listState.order = saved.order;
    }
  } catch {
    // ignore
  }

  searchInput.value = listState.query;
  statusSelect.value = listState.status;
  organizationSelect.value = listState.organizationId;
  sortSelect.value = listState.sort;
  updateOrderToggle(orderToggle, listState.order);

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      listState.query = searchInput.value.trim();
      listState.page = 0;
      void loadList();
    }
  });

  statusSelect.addEventListener('change', () => {
    listState.status = statusSelect.value;
    listState.page = 0;
    void loadList();
  });

  organizationSelect.addEventListener('change', () => {
    listState.organizationId = organizationSelect.value;
    listState.page = 0;
    void loadList();
  });

  sortSelect.addEventListener('change', () => {
    listState.sort = sortSelect.value;
    listState.page = 0;
    void loadList();
  });

  orderToggle.addEventListener('click', () => {
    listState.order = listState.order === 'asc' ? 'desc' : 'asc';
    updateOrderToggle(orderToggle, listState.order);
    listState.page = 0;
    void loadList();
  });

  refreshBtn.addEventListener('click', () => {
    listState.query = searchInput.value.trim();
    listState.page = 0;
    void loadList();
  });

  prevBtn.addEventListener('click', () => {
    if (listState.page > 0) {
      listState.page -= 1;
      void loadList();
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(listState.total / Math.max(1, listState.pageSize)));
    if (listState.page < totalPages - 1) {
      listState.page += 1;
      void loadList();
    }
  });

  createForm.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  createBtn.addEventListener('click', async () => {
    const tenant = getActiveTenantId();
    if (!tenant) {
      showError(t('tenantSelectRequired') || 'Tenant gerekli');
      return;
    }
    const payload = {
      title: createTitleInput.value.trim(),
      mandateType: createTypeInput.value.trim(),
      status:
        createStatusSelect.value && createStatusSelect.value !== 'All'
          ? createStatusSelect.value
          : 'Draft',
      organizationId: createOrgSelect.value || null,
      companyId: createCompanyInput.value.trim() || null,
      validFrom: createValidFromInput.value || null,
      validTo: createValidToInput.value || null,
      notes: createNotesInput.value.trim() || null,
      metaJson: createMetaInput.value.trim() || null
    };
    if (
      !requireFields([
        { value: payload.title, message: t('titleRequired') || 'Başlık gerekli' },
        { value: payload.mandateType, message: t('mandateTypeRequired') || 'Mandate tipi gerekli' }
      ])
    ) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const response = (await createMandate(tenant, payload)) as MutationResponse;
      if (!response.ok) {
        showError(mandateErrorMessage(response.errorCode, response.error));
        return;
      }
      createTitleInput.value = '';
      createTypeInput.value = '';
      createStatusSelect.value = 'Draft';
      createOrgSelect.value = '';
      createCompanyInput.value = '';
      createValidFromInput.value = '';
      createValidToInput.value = '';
      createNotesInput.value = '';
      createMetaInput.value = '';
      listState.page = 0;
      await loadList();
    } finally {
      setBusy(createBtn, false);
    }
  });

  void loadList();

  async function loadList(selectId?: string | null) {
    const tenant = getActiveTenantId();
    tenantInput.value = tenant ?? '';
    detailEl.innerHTML = '';
    if (!tenant) {
      listEl.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Tenant gerekli')}</div>`;
      paginationInfo.textContent = '—';
      prevBtn.setAttribute('disabled', 'true');
      nextBtn.setAttribute('disabled', 'true');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TENANT, tenant);
      localStorage.setItem(
        STORAGE_KEY_STATE,
        JSON.stringify({
          query: listState.query,
          status: listState.status,
          organizationId: listState.organizationId,
          page: listState.page,
          sort: listState.sort,
          order: listState.order
        })
      );
    } catch {
      // ignore
    }

    listEl.innerHTML = `<div class="empty">${esc(t('loading') || 'Loading')}</div>`;
    paginationInfo.textContent = t('loading') || 'Loading';
    prevBtn.setAttribute('disabled', 'true');
    nextBtn.setAttribute('disabled', 'true');

    try {
      const [response, orgOptions] = await Promise.all([
        listMandates(tenant, {
          query: listState.query,
          status: listState.status,
          organizationId: listState.organizationId || undefined,
          page: listState.page,
          pageSize: listState.pageSize,
          sort: listState.sort,
          order: listState.order
        }) as Promise<ListResponse>,
        fetchOrganizations(tenant)
      ]);

      organizations = orgOptions;
      updateOrganizationSelect(organizationSelect, organizations, true, listState.organizationId);
      updateOrganizationSelect(createOrgSelect, organizations, false, null);

      if (!response.ok) {
        const message = mandateErrorMessage(response.errorCode, response.error);
        showError(message);
        listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        paginationInfo.textContent = '—';
        return;
      }

      const items = response.items ?? [];
      listState.total = response.total ?? items.length;
      listState.page = response.page ?? listState.page;
      listState.pageSize = response.pageSize ?? listState.pageSize;
      listState.sort = response.sort ?? listState.sort;
      listState.order = response.order === 'asc' ? 'asc' : response.order === 'desc' ? 'desc' : listState.order;
      updateOrderToggle(orderToggle, listState.order);

      if (!items.length) {
        listEl.innerHTML = `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
        paginationInfo.textContent = `${listState.total} / ${listState.total}`;
        selection.id = null;
        detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord') || 'Kayıt seçin')}</div>`;
        return;
      }

      const totalPages = Math.max(1, Math.ceil(listState.total / Math.max(1, listState.pageSize)));
      if (listState.page > 0) prevBtn.removeAttribute('disabled');
      else prevBtn.setAttribute('disabled', 'true');
      if (listState.page < totalPages - 1) nextBtn.removeAttribute('disabled');
      else nextBtn.setAttribute('disabled', 'true');

      const start = listState.page * listState.pageSize + 1;
      const end = Math.min((listState.page + 1) * listState.pageSize, listState.total);
      paginationInfo.textContent = `${start}-${end} / ${listState.total} • ${listState.page + 1}/${totalPages}`;

      let nextSelected = selection.id;
      if (selectId) nextSelected = selectId;
      else if (!nextSelected || !items.some((item) => item.id === nextSelected)) {
        nextSelected = items[0]?.id ?? null;
      }
      selection.id = nextSelected;

      listEl.innerHTML = items
        .map((item) => {
          const isActive = item.id === selection.id;
          const org = item.organization ? item.organization.name : t('none') || '—';
          const dates = `${item.validFrom ?? '—'} → ${item.validTo ?? '—'}`;
          return `
            <button class="list-item ${isActive ? 'active' : ''}" data-id="${item.id}">
              <div class="title">${esc(item.title)}</div>
              <div class="meta">${esc(item.mandateType)} • ${esc(item.status)}</div>
              <div class="meta">${esc(org)}${item.companyId ? ` • ${esc(item.companyId)}` : ''}</div>
              <div class="meta" style="color:#94a3b8">${esc(dates)}</div>
            </button>
          `;
        })
        .join('');

      listEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          selection.id = btn.dataset.id ?? null;
          listEl
            .querySelectorAll<HTMLButtonElement>('button[data-id]')
            .forEach((node) => node.classList.toggle('active', node === btn));
          if (selection.id) {
            await loadDetail(selection.id);
          } else {
            detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord') || 'Kayıt seçin')}</div>`;
          }
        });
      });

      if (selection.id) {
        await loadDetail(selection.id);
      } else {
        detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord') || 'Kayıt seçin')}</div>`;
      }
    } catch (error) {
      console.error(error);
      const message = t('errorGeneric') || 'Error';
      showError(message);
      listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
      paginationInfo.textContent = '—';
    }
  }

  async function loadDetail(id: string) {
    const tenant = getActiveTenantId();
    if (!tenant) {
      detailEl.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Tenant gerekli')}</div>`;
      return;
    }
    detailEl.innerHTML = `<div class="empty">${esc(t('loading') || 'Loading')}</div>`;
    try {
      const response = (await getMandate(tenant, id)) as DetailResponse;
      if (!response.ok || !response.mandate) {
        const message = mandateErrorMessage(response.errorCode, response.error);
        showError(message);
        detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      renderDetail(response.mandate, tenant);
    } catch (error) {
      console.error(error);
      const message = t('errorGeneric') || 'Error';
      showError(message);
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
    }
  }

  function renderDetail(mandate: MandateDetail, tenantId: string) {
    detailEl.innerHTML = getDetailTemplate(mandate, organizations);
    const titleInput = requireElement<HTMLInputElement>(detailEl, '#mandate-detail-title');
    const typeInput = requireElement<HTMLInputElement>(detailEl, '#mandate-detail-type');
    const statusSelect = requireElement<HTMLSelectElement>(detailEl, '#mandate-detail-status');
    const orgSelect = requireElement<HTMLSelectElement>(detailEl, '#mandate-detail-organization');
    const companyInput = requireElement<HTMLInputElement>(detailEl, '#mandate-detail-company');
    const validFromInput = requireElement<HTMLInputElement>(detailEl, '#mandate-detail-valid-from');
    const validToInput = requireElement<HTMLInputElement>(detailEl, '#mandate-detail-valid-to');
    const notesInput = requireElement<HTMLTextAreaElement>(detailEl, '#mandate-detail-notes');
    const metaInput = requireElement<HTMLTextAreaElement>(detailEl, '#mandate-detail-meta');
    const saveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const deleteBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="delete"]');

    updateOrganizationSelect(orgSelect, organizations, false, mandate.organization?.id ?? '');

    saveBtn.addEventListener('click', async () => {
      const payload = {
        title: titleInput.value.trim(),
        mandateType: typeInput.value.trim(),
        status: statusSelect.value || mandate.status,
        organizationId: orgSelect.value || null,
        companyId: companyInput.value.trim() || null,
        validFrom: validFromInput.value || null,
        validTo: validToInput.value || null,
        notes: notesInput.value.trim() || null,
        metaJson: metaInput.value.trim() || null
      };
      if (
        !requireFields([
          { value: payload.title, message: t('titleRequired') || 'Başlık gerekli' },
          { value: payload.mandateType, message: t('mandateTypeRequired') || 'Mandate tipi gerekli' }
        ])
      ) {
        return;
      }
      setBusy(saveBtn, true);
      try {
        const response = (await updateMandate(tenantId, mandate.id, payload)) as MutationResponse;
        if (!response.ok) {
          showError(mandateErrorMessage(response.errorCode, response.error));
          return;
        }
        await loadList(mandate.id);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('confirmDelete') || 'Silmek istediğinize emin misiniz?')) return;
      setBusy(deleteBtn, true);
      try {
        const response = (await deleteMandate(tenantId, mandate.id)) as MutationResponse;
        if (!response.ok) {
          showError(mandateErrorMessage(response.errorCode, response.error));
          return;
        }
        selection.id = null;
        await loadList();
      } finally {
        setBusy(deleteBtn, false);
      }
    });
  }
}

async function fetchOrganizations(tenantId: string): Promise<OrganizationOption[]> {
  const response = await listOrganizations(tenantId, { pageSize: 200, sort: 'name', order: 'asc' });
  if (!response.ok) return [];
  return (response.items ?? []).map((item) => ({ id: item.id, name: item.name }));
}

function updateOrganizationSelect(
  select: HTMLSelectElement,
  options: OrganizationOption[],
  allowAll: boolean,
  selectedId: string | null
) {
  const entries = options
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (option) =>
        `<option value="${option.id}"${selectedId === option.id ? ' selected' : ''}>${esc(option.name)}</option>`
    )
    .join('');
  select.innerHTML = `${allowAll ? `<option value="">${esc(t('all') || 'All')}</option>` : '<option value="">—</option>'}${entries}`;
  if (selectedId) {
    select.value = selectedId;
  }
}

function updateOrderToggle(button: HTMLButtonElement, order: 'asc' | 'desc') {
  button.dataset.order = order;
  button.textContent = order === 'asc' ? '↑' : '↓';
  button.title =
    order === 'asc'
      ? t('tenantSortAscending') || 'Ascending'
      : t('tenantSortDescending') || 'Descending';
}

function getShell() {
  const title = t('tenant.mandates.title') || 'Mandates';
  const searchLabel = t('search') || 'Search';
  const reloadLabel = t('reload') || 'Reload';
  const createLabel = t('create') || 'Create';
  return `
    <div style="padding:16px;font-family:ui-sans-serif;max-width:960px">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(title)}</h2>
      <div class="mandates-wrap">
        <div class="controls">
          <label class="label">${esc(t('tenantId') || 'Tenant')}</label>
          <input id="mandate-tenant" class="input" />
          <label class="label">${esc(searchLabel)}</label>
          <div class="search-row">
            <input id="mandate-search" class="input" placeholder="${esc(searchLabel)}" />
            <button class="btn" data-action="refresh">${esc(reloadLabel)}</button>
          </div>
          <label class="label">${esc(t('status') || 'Status')}</label>
          <select id="mandate-status" class="input">
            ${STATUS_OPTIONS.map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
          </select>
          <label class="label">${esc(t('tenant.organizations.title') || 'Organizations')}</label>
          <select id="mandate-organization-filter" class="input"></select>
          <div class="search-row" style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <label class="label" style="margin:0">${esc(t('sort') || 'Sort')}</label>
            <select id="mandate-sort" class="input" style="flex:1">
              ${SORT_OPTIONS.map((option) => `<option value="${option.value}">${esc(t(option.label) || option.label)}</option>`).join('')}
            </select>
            <button class="btn" id="mandate-order-toggle" data-order="desc">↓</button>
          </div>
          <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#475569">
            <span id="mandate-pagination-info">—</span>
            <div style="display:flex;gap:8px">
              <button class="btn" id="mandate-page-prev" disabled>${esc(t('tenantPaginationPrev') || 'Önceki')}</button>
              <button class="btn" id="mandate-page-next" disabled>${esc(t('tenantPaginationNext') || 'Sonraki')}</button>
            </div>
          </div>
          <form id="mandate-create-form" style="margin-top:16px">
            <div style="font-weight:600;margin-bottom:8px">${esc(createLabel)}</div>
            <div class="form-row column" style="gap:8px">
              <input id="mandate-create-title" class="input" placeholder="${esc(t('title') || 'Başlık')}" />
              <input id="mandate-create-type" class="input" placeholder="${esc(t('mandateType') || 'Mandate tipi')}" />
              <select id="mandate-create-status" class="input">
                ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
              </select>
              <select id="mandate-create-organization" class="input"></select>
              <input id="mandate-create-company" class="input" placeholder="${esc(t('companyId') || 'companyId')}" />
              <input id="mandate-create-valid-from" class="input" type="date" />
              <input id="mandate-create-valid-to" class="input" type="date" />
              <textarea id="mandate-create-notes" class="input" placeholder="${esc(t('notes') || 'Notlar')}"></textarea>
              <textarea id="mandate-create-meta" class="input" placeholder="metaJson"></textarea>
              <button class="btn primary" data-action="create">${esc(createLabel)}</button>
            </div>
          </form>
        </div>
        <div class="content">
          <div class="list" data-role="list"></div>
          <div class="detail" data-role="detail"></div>
        </div>
      </div>
    </div>
  `;
}

function getDetailTemplate(mandate: MandateDetail, organizations: OrganizationOption[]) {
  const options = organizations
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (org) =>
        `<option value="${org.id}"${mandate.organization?.id === org.id ? ' selected' : ''}>${esc(org.name)}</option>`
    )
    .join('');
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(mandate.title)}</h3>
          <div class="meta">${esc(mandate.mandateType)} • ${esc(mandate.status)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save') || 'Kaydet')}</button>
          <button class="btn danger" data-action="delete">${esc(t('delete') || 'Sil')}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('title') || 'Başlık')}</label>
        <input id="mandate-detail-title" class="input" value="${esc(mandate.title)}" />
        <label class="label">${esc(t('mandateType') || 'Mandate tipi')}</label>
        <input id="mandate-detail-type" class="input" value="${esc(mandate.mandateType)}" />
        <label class="label">${esc(t('status') || 'Status')}</label>
        <select id="mandate-detail-status" class="input">
          ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}"${mandate.status === status ? ' selected' : ''}>${esc(status)}</option>`).join('')}
        </select>
        <label class="label">${esc(t('tenant.organizations.title') || 'Organization')}</label>
        <select id="mandate-detail-organization" class="input">
          <option value="">${esc(t('none') || '—')}</option>
          ${options}
        </select>
        <label class="label">${esc(t('companyId') || 'companyId')}</label>
        <input id="mandate-detail-company" class="input" value="${esc(mandate.companyId ?? '')}" />
        <label class="label">${esc(t('validFrom') || 'Valid from')}</label>
        <input id="mandate-detail-valid-from" class="input" type="date" value="${mandate.validFrom ?? ''}" />
        <label class="label">${esc(t('validTo') || 'Valid to')}</label>
        <input id="mandate-detail-valid-to" class="input" type="date" value="${mandate.validTo ?? ''}" />
        <label class="label">${esc(t('notes') || 'Notlar')}</label>
        <textarea id="mandate-detail-notes" class="input">${esc(mandate.notes ?? '')}</textarea>
        <label class="label">metaJson</label>
        <textarea id="mandate-detail-meta" class="input">${esc(mandate.metaJson ?? '')}</textarea>
      </div>
      <section style="margin-top:16px;color:#94a3b8;font-size:12px">
        <div>${esc(t('createdAt') || 'Created')}: ${esc(mandate.createdAt ?? '—')}</div>
        <div>${esc(t('updatedAt') || 'Updated')}: ${esc(mandate.updatedAt ?? '—')}</div>
      </section>
    </div>
  `;
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

function setBusy(button: HTMLButtonElement, busy: boolean) {
  if (busy) {
    button.setAttribute('disabled', 'true');
    button.dataset.originalText = button.dataset.originalText || button.textContent || '';
    button.textContent = '...';
  } else {
    button.removeAttribute('disabled');
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}
