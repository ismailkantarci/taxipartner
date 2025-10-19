import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganization
} from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import { getActiveTenantId } from '../ui/activeTenant';
import { requireElement, optionalElement } from '../ui/dom';
import { STORAGE_KEY_ACTIVE_TENANT } from '../ui/storageKeys';

type OrganizationListItem = {
  id: string;
  name: string;
  orgType?: string | null;
  status: string;
  parentId?: string | null;
  companyId?: string | null;
  mandates?: number;
  updatedAt?: string;
};

type OrganizationDetail = OrganizationListItem & {
  description?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  metaJson?: string | null;
  createdAt?: string;
  mandatesList?: Array<{
    id: string;
    title: string;
    status: string;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
};

type ListResponse = {
  ok: boolean;
  items?: OrganizationListItem[];
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
  organization?: {
    id: string;
    name: string;
    orgType?: string | null;
    status: string;
    parentId?: string | null;
    companyId?: string | null;
    description?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
    metaJson?: string | null;
    createdAt: string;
    updatedAt: string;
    mandates: Array<{
      id: string;
      title: string;
      status: string;
      validFrom?: string | null;
      validTo?: string | null;
    }>;
  };
  error?: string;
  errorCode?: string;
};

type ListState = {
  query: string;
  status: string;
  page: number;
  pageSize: number;
  total: number;
  sort: string;
  order: 'asc' | 'desc';
};

type OrganizationOption = OrganizationListItem & { depth: number };

const STORAGE_KEY_STATE = 'tp_orgs_state';
const DEFAULT_PAGE_SIZE = 20;
const STATUS_OPTIONS = ['All', 'Active', 'Ruhend', 'Gelöscht', 'Suspended'];
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'updated', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' }
];

const ORGANIZATION_ERROR_I18N: Record<string, string> = {
  TENANT_ID_REQUIRED: 'organizations.error.tenantRequired',
  ORG_NAME_REQUIRED: 'organizations.error.nameRequired',
  ORG_PARENT_INVALID: 'organizations.error.parentInvalid',
  ORG_COMPANY_INVALID: 'organizations.error.companyInvalid',
  ORG_NOT_FOUND: 'organizations.error.notFound',
  ORG_DELETE_HAS_CHILDREN: 'organizations.error.deleteHasChildren',
  ORG_DELETE_HAS_MANDATES: 'organizations.error.deleteHasMandates'
};

function organizationErrorMessage(code?: string, fallback?: string) {
  if (code) {
    const key = ORGANIZATION_ERROR_I18N[code];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
  }
  return fallback || t('errorGeneric') || 'Error';
}

export async function mountOrganizationsPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'organizations', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('organizations')) return;
    attr.push('organizations');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }

  const activeTenantId = getActiveTenantId();
  if (!activeTenantId) {
    root.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Önce tenant seçin')}</div>`;
    return;
  }

  root.innerHTML = getShell();

  const tenantInput = requireElement<HTMLInputElement>(root, '#org-tenant');
  tenantInput.value = activeTenantId;
  tenantInput.setAttribute('readonly', 'true');
  tenantInput.style.cursor = 'not-allowed';
  tenantInput.style.backgroundColor = 'rgba(241,245,249,0.6)';
  tenantInput.title = t('tenantLockedHint') || 'Tenant seçimi üstten yapılır';

  const searchInput = requireElement<HTMLInputElement>(root, '#org-search');
  const statusSelect = requireElement<HTMLSelectElement>(root, '#org-status');
  const sortSelect = requireElement<HTMLSelectElement>(root, '#org-sort');
  const orderToggle = requireElement<HTMLButtonElement>(root, '#org-order-toggle');
  const listEl = requireElement<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = requireElement<HTMLDivElement>(root, '[data-role="detail"]');
  const paginationInfo = requireElement<HTMLSpanElement>(root, '#org-pagination-info');
  const prevBtn = requireElement<HTMLButtonElement>(root, '#org-page-prev');
  const nextBtn = requireElement<HTMLButtonElement>(root, '#org-page-next');
  const refreshBtn = requireElement<HTMLButtonElement>(root, '[data-action="refresh"]');

  const createForm = requireElement<HTMLFormElement>(root, '#org-create-form');
  const createNameInput = requireElement<HTMLInputElement>(createForm, '#org-create-name');
  const createTypeInput = requireElement<HTMLInputElement>(createForm, '#org-create-type');
  const createStatusSelect = requireElement<HTMLSelectElement>(createForm, '#org-create-status');
  const createParentSelect = requireElement<HTMLSelectElement>(createForm, '#org-create-parent');
  const createCompanyInput = requireElement<HTMLInputElement>(createForm, '#org-create-company');
  const createValidFromInput = requireElement<HTMLInputElement>(createForm, '#org-create-valid-from');
  const createValidToInput = requireElement<HTMLInputElement>(createForm, '#org-create-valid-to');
  const createDescriptionInput = requireElement<HTMLTextAreaElement>(createForm, '#org-create-description');
  const createMetaInput = requireElement<HTMLTextAreaElement>(createForm, '#org-create-meta');
  const createBtn = requireElement<HTMLButtonElement>(createForm, '[data-action="create"]');

  const listState: ListState = {
    query: '',
    status: 'All',
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    sort: 'updated',
    order: 'desc'
  };

  let parentOptions: OrganizationOption[] = [];
  const selection = { id: null as string | null };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_STATE) || 'null') as
      | { query?: string; status?: string; page?: number; sort?: string; order?: 'asc' | 'desc' }
      | null;
    if (saved) {
      if (typeof saved.query === 'string') listState.query = saved.query;
      if (typeof saved.status === 'string') listState.status = saved.status;
      if (typeof saved.page === 'number' && saved.page >= 0) listState.page = saved.page;
      if (typeof saved.sort === 'string') listState.sort = saved.sort;
      if (saved.order === 'asc' || saved.order === 'desc') listState.order = saved.order;
    }
  } catch {
    // ignore
  }

  searchInput.value = listState.query;
  statusSelect.value = listState.status;
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
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      showError(t('tenantSelectRequired') || 'Tenant gerekli');
      return;
    }
    const payload = {
      name: createNameInput.value.trim(),
      orgType: createTypeInput.value.trim() || null,
      status:
        createStatusSelect.value && createStatusSelect.value !== 'All'
          ? createStatusSelect.value
          : 'Active',
      parentId: createParentSelect.value || null,
      companyId: createCompanyInput.value.trim() || null,
      validFrom: createValidFromInput.value || null,
      validTo: createValidToInput.value || null,
      description: createDescriptionInput.value.trim() || null,
      metaJson: createMetaInput.value.trim() || null
    };
    if (!requireFields([{ value: payload.name, message: t('legalNameRequired') || 'Ad gerekli' }])) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const response = (await createOrganization(tenantId, payload)) as MutationResponse;
      if (!response.ok) {
        showError(organizationErrorMessage(response.errorCode, response.error));
        return;
      }
      createNameInput.value = '';
      createTypeInput.value = '';
      createStatusSelect.value = 'Active';
      createParentSelect.value = '';
      createCompanyInput.value = '';
      createValidFromInput.value = '';
      createValidToInput.value = '';
      createDescriptionInput.value = '';
      createMetaInput.value = '';
      listState.page = 0;
      await loadList();
    } finally {
      setBusy(createBtn, false);
    }
  });

  void loadList();

  async function loadList(selectId?: string | null) {
    const tenantId = getActiveTenantId();
    tenantInput.value = tenantId ?? '';
    detailEl.innerHTML = '';
    if (!tenantId) {
      listEl.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Tenant gerekli')}</div>`;
      paginationInfo.textContent = '—';
      prevBtn.setAttribute('disabled', 'true');
      nextBtn.setAttribute('disabled', 'true');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TENANT, tenantId);
      localStorage.setItem(
        STORAGE_KEY_STATE,
        JSON.stringify({
          query: listState.query,
          status: listState.status,
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
      const [response, parentList] = await Promise.all([
        listOrganizations(tenantId, {
          query: listState.query,
          status: listState.status,
          page: listState.page,
          pageSize: listState.pageSize,
          sort: listState.sort,
          order: listState.order
        }) as Promise<ListResponse>,
        collectAllOrganizations(tenantId)
      ]);

      parentOptions = parentList;
      updateParentSelect(createParentSelect, parentOptions, null);

      if (!response.ok) {
        const message = organizationErrorMessage(response.errorCode, response.error);
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

      const parentNameMap = new Map(parentOptions.map((option) => [option.id, option.name]));

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
          const parentName = item.parentId ? parentNameMap.get(item.parentId) || '—' : '—';
          return `
            <button class="list-item ${isActive ? 'active' : ''}" data-id="${item.id}">
              <div class="title">${esc(item.name)}</div>
              <div class="meta">${esc(t('status') || 'Status')}: ${esc(item.status)} • ${esc(
                t('parent') || 'Parent'
              )}: ${esc(parentName)}</div>
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
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      detailEl.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Tenant gerekli')}</div>`;
      return;
    }
    detailEl.innerHTML = `<div class="empty">${esc(t('loading') || 'Loading')}</div>`;
    try {
      const response = (await getOrganization(tenantId, id)) as DetailResponse;
      if (!response.ok || !response.organization) {
        const message = organizationErrorMessage(response.errorCode, response.error);
        showError(message);
        detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      const organization: OrganizationDetail = {
        id: response.organization.id,
        name: response.organization.name,
        orgType: response.organization.orgType ?? null,
        status: response.organization.status,
        parentId: response.organization.parentId ?? null,
        companyId: response.organization.companyId ?? null,
        mandates: response.organization.mandates.length,
        updatedAt: response.organization.updatedAt,
        description: response.organization.description ?? null,
        validFrom: response.organization.validFrom ?? null,
        validTo: response.organization.validTo ?? null,
        metaJson: response.organization.metaJson ?? null,
        createdAt: response.organization.createdAt,
        mandatesList: response.organization.mandates
      };
      renderDetail(organization, tenantId);
    } catch (error) {
      console.error(error);
      const message = t('errorGeneric') || 'Error';
      showError(message);
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
    }
  }

  function renderDetail(organization: OrganizationDetail, tenantId: string) {
    detailEl.innerHTML = getDetailTemplate(organization, parentOptions);
    const nameInput = requireElement<HTMLInputElement>(detailEl, '#org-detail-name');
    const typeInput = requireElement<HTMLInputElement>(detailEl, '#org-detail-type');
    const statusSelect = requireElement<HTMLSelectElement>(detailEl, '#org-detail-status');
    const parentSelect = requireElement<HTMLSelectElement>(detailEl, '#org-detail-parent');
    const companyInput = requireElement<HTMLInputElement>(detailEl, '#org-detail-company');
    const validFromInput = requireElement<HTMLInputElement>(detailEl, '#org-detail-valid-from');
    const validToInput = requireElement<HTMLInputElement>(detailEl, '#org-detail-valid-to');
    const descriptionInput = requireElement<HTMLTextAreaElement>(detailEl, '#org-detail-description');
    const metaInput = requireElement<HTMLTextAreaElement>(detailEl, '#org-detail-meta');
    const saveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const deleteBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="delete"]');

    updateParentSelect(parentSelect, parentOptions, organization.id, organization.parentId ?? null);

    saveBtn.addEventListener('click', async () => {
      const payload = {
        name: nameInput.value.trim(),
        orgType: typeInput.value.trim() || null,
        status: statusSelect.value || organization.status,
        parentId: parentSelect.value || null,
        companyId: companyInput.value.trim() || null,
        validFrom: validFromInput.value || null,
        validTo: validToInput.value || null,
        description: descriptionInput.value.trim() || null,
        metaJson: metaInput.value.trim() || null
      };
      if (!requireFields([{ value: payload.name, message: t('legalNameRequired') || 'Ad gerekli' }])) {
        return;
      }
      setBusy(saveBtn, true);
      try {
        const response = (await updateOrganization(tenantId, organization.id, payload)) as MutationResponse;
        if (!response.ok) {
          showError(organizationErrorMessage(response.errorCode, response.error));
          return;
        }
        await loadList(organization.id);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('confirmDelete') || 'Silmek istediğinize emin misiniz?')) return;
      setBusy(deleteBtn, true);
      try {
        const response = (await deleteOrganization(tenantId, organization.id)) as MutationResponse;
        if (!response.ok) {
          showError(organizationErrorMessage(response.errorCode, response.error));
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

async function collectAllOrganizations(tenantId: string): Promise<OrganizationOption[]> {
  const aggregated: OrganizationListItem[] = [];
  let page = 0;
  const pageSize = 200;
  let total = Number.POSITIVE_INFINITY;
  while (aggregated.length < total) {
    const response = await listOrganizations(tenantId, {
      page,
      pageSize,
      sort: 'name',
      order: 'asc'
    });
    if (!response.ok) {
      throw new Error(response.error || 'Failed to load organizations');
    }
    const items = response.items ?? [];
    aggregated.push(...items);
    total = response.total ?? aggregated.length;
    if (items.length < pageSize) break;
    page += 1;
  }
  const byId = new Map(aggregated.map((item) => [item.id, item]));
  const depthCache = new Map<string, number>();
  const depthOf = (item: OrganizationListItem): number => {
    if (depthCache.has(item.id)) return depthCache.get(item.id)!;
    const parent = item.parentId ? byId.get(item.parentId) : null;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthCache.set(item.id, depth);
    return depth;
  };
  return aggregated.map((item) => ({ ...item, depth: depthOf(item) }));
}

function updateParentSelect(
  select: HTMLSelectElement,
  options: OrganizationOption[],
  excludeId: string | null,
  currentParent: string | null = null
) {
  const descendantSet = excludeId ? buildDescendantSet(excludeId, options) : new Set<string>();
  const entries = options
    .slice()
    .filter((option) => option.id !== excludeId && !descendantSet.has(option.id))
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.name.localeCompare(b.name);
    })
    .map(
      (opt) =>
        `<option value="${opt.id}"${opt.id === currentParent ? ' selected' : ''}>${'— '.repeat(opt.depth)}${esc(
          opt.name
        )}</option>`
    )
    .join('');
  select.innerHTML = `<option value="">${esc(t('none') || '—')}</option>${entries}`;
}

function buildDescendantSet(id: string, options: OrganizationOption[]): Set<string> {
  const byParent = new Map<string | null, OrganizationOption[]>();
  options.forEach((option) => {
    const key = option.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(option);
  });
  const result = new Set<string>();
  const queue: string[] = [id];
  while (queue.length) {
    const current = queue.shift()!;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }
  result.delete(id);
  return result;
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
  const title = t('tenant.organizations.title') || t('organizations') || 'Organizations';
  const searchLabel = t('search') || 'Search';
  const reloadLabel = t('reload') || 'Reload';
  const createLabel = t('create') || 'Create';
  return `
    <div style="padding:16px;font-family:ui-sans-serif;max-width:960px">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(title)}</h2>
      <div class="organizations-wrap">
        <div class="controls">
          <label class="label">${esc(t('tenantId') || 'Tenant')}</label>
          <input id="org-tenant" class="input" />
          <label class="label">${esc(searchLabel)}</label>
          <div class="search-row">
            <input id="org-search" class="input" placeholder="${esc(searchLabel)}" />
            <button class="btn" data-action="refresh">${esc(reloadLabel)}</button>
          </div>
          <label class="label">${esc(t('status') || 'Status')}</label>
          <select id="org-status" class="input">
            ${STATUS_OPTIONS.map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
          </select>
          <div class="search-row" style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <label class="label" style="margin:0">${esc(t('sort') || 'Sort')}</label>
            <select id="org-sort" class="input" style="flex:1">
              ${SORT_OPTIONS.map((option) => `<option value="${option.value}">${esc(t(option.label) || option.label)}</option>`).join('')}
            </select>
            <button class="btn" id="org-order-toggle" data-order="desc">↓</button>
          </div>
          <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#475569">
            <span id="org-pagination-info">—</span>
            <div style="display:flex;gap:8px">
              <button class="btn" id="org-page-prev" disabled>${esc(t('tenantPaginationPrev') || 'Önceki')}</button>
              <button class="btn" id="org-page-next" disabled>${esc(t('tenantPaginationNext') || 'Sonraki')}</button>
            </div>
          </div>
          <form id="org-create-form" style="margin-top:16px">
            <div style="font-weight:600;margin-bottom:8px">${esc(createLabel)}</div>
            <div class="form-row column" style="gap:8px">
              <input id="org-create-name" class="input" placeholder="${esc(t('legalName') || 'Adı')}" />
              <input id="org-create-type" class="input" placeholder="${esc(t('type') || 'Tip')}" />
              <select id="org-create-status" class="input">
                ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
              </select>
              <select id="org-create-parent" class="input"></select>
              <input id="org-create-company" class="input" placeholder="${esc(t('companyId') || 'companyId')}" />
              <input id="org-create-valid-from" class="input" type="date" />
              <input id="org-create-valid-to" class="input" type="date" />
              <textarea id="org-create-description" class="input" placeholder="${esc(t('description') || 'Açıklama')}"></textarea>
              <textarea id="org-create-meta" class="input" placeholder='metaJson'></textarea>
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

function getDetailTemplate(organization: OrganizationDetail, options: OrganizationOption[]) {
  const optionMarkup = options
    .slice()
    .filter((opt) => opt.id !== organization.id)
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.name.localeCompare(b.name);
    })
    .map(
      (opt) =>
        `<option value="${opt.id}"${opt.id === organization.parentId ? ' selected' : ''}>${'— '.repeat(
          opt.depth
        )}${esc(opt.name)}</option>`
    )
    .join('');
  const mandatesMarkup =
    organization.mandatesList && organization.mandatesList.length
      ? organization.mandatesList
          .map(
            (mandate) => `
            <li>
              <strong>${esc(mandate.title)}</strong>
              <span style="color:#475569">(${esc(mandate.status)})</span>
              <span style="color:#94a3b8">${esc(mandate.validFrom ?? '—')} → ${esc(mandate.validTo ?? '—')}</span>
            </li>
          `
          )
          .join('')
      : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(organization.name)}</h3>
          <div class="meta">${esc(t('status') || 'Status')}: ${esc(organization.status)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save') || 'Kaydet')}</button>
          <button class="btn danger" data-action="delete">${esc(t('delete') || 'Sil')}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('legalName') || 'Adı')}</label>
        <input id="org-detail-name" class="input" value="${esc(organization.name)}" />
        <label class="label">${esc(t('type') || 'Tip')}</label>
        <input id="org-detail-type" class="input" value="${esc(organization.orgType ?? '')}" />
        <label class="label">${esc(t('status') || 'Status')}</label>
        <select id="org-detail-status" class="input">
          ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}"${organization.status === status ? ' selected' : ''}>${esc(status)}</option>`).join('')}
        </select>
        <label class="label">${esc(t('parent') || 'Parent')}</label>
        <select id="org-detail-parent" class="input">
          <option value="">${esc(t('none') || '—')}</option>
          ${optionMarkup}
        </select>
        <label class="label">${esc(t('companyId') || 'companyId')}</label>
        <input id="org-detail-company" class="input" value="${esc(organization.companyId ?? '')}" />
        <label class="label">${esc(t('validFrom') || 'Valid from')}</label>
        <input id="org-detail-valid-from" class="input" type="date" value="${organization.validFrom ?? ''}" />
        <label class="label">${esc(t('validTo') || 'Valid to')}</label>
        <input id="org-detail-valid-to" class="input" type="date" value="${organization.validTo ?? ''}" />
        <label class="label">${esc(t('description') || 'Açıklama')}</label>
        <textarea id="org-detail-description" class="input">${esc(organization.description ?? '')}</textarea>
        <label class="label">metaJson</label>
        <textarea id="org-detail-meta" class="input">${esc(organization.metaJson ?? '')}</textarea>
      </div>
      <section style="margin-top:16px">
        <h4>${esc(t('tenant.mandates.title') || 'Mandates')}</h4>
        ${
          organization.mandatesList && organization.mandatesList.length
            ? `<ul class="meta">${mandatesMarkup}</ul>`
            : mandatesMarkup
        }
      </section>
      <section style="margin-top:16px;color:#94a3b8;font-size:12px">
        <div>${esc(t('createdAt') || 'Created')}: ${esc(organization.createdAt ?? '—')}</div>
        <div>${esc(t('updatedAt') || 'Updated')}: ${esc(organization.updatedAt ?? '—')}</div>
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
