import {
  listCompanies,
  createCompany,
  getCompany,
  updateCompany,
  deleteCompany,
  addOfficer,
  removeOfficer,
  addShareholder,
  removeShareholder,
  addCompanyDoc,
  removeCompanyDoc,
  createPermit,
  addPermitEvent,
  createPermitVehicle,
  revokePermitVehicle,
  type CompanyOrder,
  type CompanySortKey
} from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import { getActiveTenantId } from '../ui/activeTenant';
import { requireElement, optionalElement } from '../ui/dom';
import { STORAGE_KEY_ACTIVE_TENANT, STORAGE_KEY_COMPANIES_STATE } from '../ui/storageKeys';

type CompanyStatus = 'Active' | 'Ruhend' | 'Gelöscht';

type CompanyListItem = {
  companyId: string;
  legalName: string;
  address: string;
  status?: CompanyStatus | null;
  validTo?: string | null;
  permitCount?: number | null;
  officerCount?: number | null;
  shareholdingCount?: number | null;
  vehicleAssignmentCount?: number | null;
  driverAssignmentCount?: number | null;
};

type CompanyOfficer = {
  id: string;
  type: string;
  userId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
};

type CompanyShareholder = {
  id: string;
  personName: string;
  roleType: string;
  percent?: number | null;
};

type CompanyDocument = {
  id: string;
  title: string;
  docType: string;
  url?: string | null;
  metaJson?: unknown;
};

type CompanyPermit = {
  id: string;
  companyId: string;
  permitType: string;
  issuingAuthority?: string | null;
  referenceNo?: string | null;
  permitRegisteredOn?: string | null;
  effectiveFrom?: string | null;
  validUntil?: string | null;
  capacityPkw?: number | null;
  vehicleScoped?: boolean | null;
  status: CompanyStatus;
  vehicleAuthorizations?: CompanyPermitVehicle[];
};

type CompanyPermitVehicle = {
  id: string;
  permitId: string;
  vehicleId?: string | null;
  vin: string;
  authorizedOn: string;
  revokedOn?: string | null;
};

type CompanyPermitEventType = 'REGISTERED' | 'ACTIVE' | 'RUHEND' | 'WIEDERBETRIEB' | 'GELOESCHT';

type CompanyPermitEvent = {
  id: string;
  companyId: string;
  permitId?: string | null;
  referenceNo?: string | null;
  eventType: CompanyPermitEventType;
  eventDate: string;
  sourceDocRef?: string | null;
};

type CompanyDetail = CompanyListItem & {
  officers?: CompanyOfficer[];
  shareholders?: CompanyShareholder[];
  documents?: CompanyDocument[];
  permits?: CompanyPermit[];
  permitEvents?: CompanyPermitEvent[];
};

type ListResponse = {
  ok: boolean;
  items?: CompanyListItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string | null;
  order?: string | null;
  error?: string;
};

type DetailResponse = {
  ok: boolean;
  company?: CompanyDetail;
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
  company?: CompanyDetail;
  officer?: CompanyOfficer;
  shareholder?: CompanyShareholder;
  document?: CompanyDocument;
  permit?: CompanyPermit;
  event?: CompanyPermitEvent;
  authorization?: CompanyPermitVehicle;
};

type CompanyListState = {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  sort: CompanySortKey;
  order: CompanyOrder;
};

const DEFAULT_COMPANY_PAGE_SIZE = 20;

const COMPANY_SORT_OPTIONS: Array<{ value: CompanySortKey; labelKey: string; fallback: string }> = [
  { value: 'name', labelKey: 'companySortName', fallback: 'Name' },
  { value: 'status', labelKey: 'companySortStatus', fallback: 'Status' },
  { value: 'companyid', labelKey: 'companySortId', fallback: 'Company ID' }
];

const ORDER_ICONS: Record<CompanyOrder, string> = {
  asc: '↑',
  desc: '↓'
};

function isCompanySortKey(value: unknown): value is CompanySortKey {
  return value === 'name' || value === 'status' || value === 'companyid';
}

function translateOrFallback(key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

export async function mountCompaniesPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'companies', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('companies')) return;
    attr.push('companies');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }
  const activeTenantId = getActiveTenantId();
  if (!activeTenantId) {
    root.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Bitte önce tenant seçin')}</div>`;
    return;
  }
  const paginationLabels = {
    paginationPrev: translateOrFallback('tenantPaginationPrev', 'Önceki'),
    paginationNext: translateOrFallback('tenantPaginationNext', 'Sonraki'),
    paginationIdle: translateOrFallback('tenantPaginationIdle', '—')
  };
  root.innerHTML = getShell(paginationLabels);

  const tenantInput = requireElement<HTMLInputElement>(root, '#companies-tenant');
  tenantInput.value = activeTenantId;
  tenantInput.setAttribute('readonly', 'true');
  tenantInput.style.cursor = 'not-allowed';
  tenantInput.style.backgroundColor = 'rgba(241,245,249,0.6)';
  tenantInput.title = t('tenantLockedHint') || 'Aktif tenant header üzerinden seçilir';
  const searchInput = requireElement<HTMLInputElement>(root, '#companies-search');
  const companyIdInput = requireElement<HTMLInputElement>(root, '#companies-create-id');
  const nameInput = requireElement<HTMLInputElement>(root, '#companies-create-name');
  const addressInput = requireElement<HTMLInputElement>(root, '#companies-create-address');
  const createBtn = requireElement<HTMLButtonElement>(root, '[data-action="create"]');
  const refreshBtn = requireElement<HTMLButtonElement>(root, '[data-action="refresh"]');
  const listEl = requireElement<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = requireElement<HTMLDivElement>(root, '[data-role="detail"]');
  const sortSelect = requireElement<HTMLSelectElement>(root, '#companies-sort');
  const orderToggle = requireElement<HTMLButtonElement>(root, '#companies-order-toggle');
  const paginationInfo = requireElement<HTMLDivElement>(root, '#companies-pagination-info');
  const pagePrevBtn = requireElement<HTMLButtonElement>(root, '#companies-page-prev');
  const pageNextBtn = requireElement<HTMLButtonElement>(root, '#companies-page-next');

  const state: { selectedId: string | null } = { selectedId: null };
  const stateKey = STORAGE_KEY_COMPANIES_STATE;
  let lastItems: CompanyListItem[] = [];
  const listState: CompanyListState = {
    query: '',
    page: 0,
    pageSize: DEFAULT_COMPANY_PAGE_SIZE,
    total: 0,
    sort: 'name',
    order: 'asc'
  };

  const applyOrderToggleVisual = () => {
    orderToggle.dataset.order = listState.order;
    orderToggle.textContent = ORDER_ICONS[listState.order];
    const title =
      listState.order === 'asc'
        ? translateOrFallback('tenantSortAscending', 'Ascending')
        : translateOrFallback('tenantSortDescending', 'Descending');
    orderToggle.title = title;
    orderToggle.setAttribute('aria-label', title);
  };

  const setPaginationIdle = () => {
    paginationInfo.textContent = paginationLabels.paginationIdle;
    pagePrevBtn.setAttribute('disabled', 'true');
    pageNextBtn.setAttribute('disabled', 'true');
  };

  const loadingLabel = translateOrFallback('loading', 'Loading...');
  const noRecordsLabel = t('noRecords') || 'No records';
  const selectRecordLabel = t('selectRecord') || 'Select a record';

  const metricLabels = {
    permits: translateOrFallback('permits', 'Permits'),
    vehicles: translateOrFallback('vehicleAssignmentsTitle', 'Vehicle assignments'),
    officers: translateOrFallback('officersTitle', 'Officers'),
    shareholders: translateOrFallback('shareholdingsTitle', 'Shareholdings'),
    drivers: translateOrFallback('driverAssignmentsTitle', 'Driver assignments')
  };

  const metricsForItem = (item: CompanyListItem): string | null => {
    const parts: string[] = [];
    if (typeof item.permitCount === 'number') {
      parts.push(`${item.permitCount} ${metricLabels.permits}`);
    }
    if (typeof item.vehicleAssignmentCount === 'number') {
      parts.push(`${item.vehicleAssignmentCount} ${metricLabels.vehicles}`);
    }
    if (typeof item.officerCount === 'number') {
      parts.push(`${item.officerCount} ${metricLabels.officers}`);
    }
    if (typeof item.shareholdingCount === 'number') {
      parts.push(`${item.shareholdingCount} ${metricLabels.shareholders}`);
    }
    if (typeof item.driverAssignmentCount === 'number') {
      parts.push(`${item.driverAssignmentCount} ${metricLabels.drivers}`);
    }
    if (!parts.length) {
      return null;
    }
    return parts.map((part) => esc(part)).join(' • ');
  };

  const setPaginationLoading = () => {
    paginationInfo.textContent = loadingLabel;
    pagePrevBtn.setAttribute('disabled', 'true');
    pageNextBtn.setAttribute('disabled', 'true');
  };

  const updatePaginationControls = (currentCount: number) => {
    const total = Number.isFinite(listState.total) ? Math.max(0, listState.total) : 0;
    if (!total) {
      setPaginationIdle();
      return;
    }
    const pageSize = Math.max(1, listState.pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = listState.page * pageSize + (currentCount ? 1 : 0);
    const endIndex = listState.page * pageSize + currentCount;
    const rangeLabel = currentCount ? `${startIndex}-${endIndex} / ${total}` : `0 / ${total}`;
    const pageLabel = `${listState.page + 1}/${totalPages}`;
    paginationInfo.textContent = `${rangeLabel} • ${pageLabel}`;
    if (listState.page > 0) {
      pagePrevBtn.removeAttribute('disabled');
    } else {
      pagePrevBtn.setAttribute('disabled', 'true');
    }
    if (listState.page < totalPages - 1) {
      pageNextBtn.removeAttribute('disabled');
    } else {
      pageNextBtn.setAttribute('disabled', 'true');
    }
  };

  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || 'null') as
      | {
          tenantId?: string;
          search?: string;
          page?: number;
          sort?: string | null;
          order?: string | null;
        }
      | null;
    if (saved) {
      if (typeof saved.search === 'string') {
        listState.query = saved.search;
      }
      const tenantMatches = !saved.tenantId || saved.tenantId === activeTenantId;
      if (tenantMatches && typeof saved.page === 'number' && saved.page >= 0) {
        listState.page = saved.page;
      }
      if (isCompanySortKey(saved.sort)) {
        listState.sort = saved.sort;
      }
      if (saved.order === 'desc' || saved.order === 'asc') {
        listState.order = saved.order;
      }
    }
  } catch {}

  searchInput.value = listState.query;
  sortSelect.value = listState.sort;
  applyOrderToggleVisual();
  setPaginationIdle();

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      listState.query = searchInput.value.trim();
      listState.page = 0;
      void loadList();
    }
  });

  refreshBtn.addEventListener('click', () => {
    listState.query = searchInput.value.trim();
    void loadList();
  });

  sortSelect.addEventListener('change', () => {
    const nextSort = sortSelect.value;
    if (isCompanySortKey(nextSort)) {
      listState.sort = nextSort;
    } else {
      listState.sort = 'name';
      sortSelect.value = listState.sort;
    }
    listState.page = 0;
    void loadList();
  });

  orderToggle.addEventListener('click', () => {
    listState.order = listState.order === 'asc' ? 'desc' : 'asc';
    applyOrderToggleVisual();
    listState.page = 0;
    void loadList();
  });

  pagePrevBtn.addEventListener('click', () => {
    if (listState.page > 0) {
      listState.page -= 1;
      void loadList();
    }
  });

  pageNextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(listState.total / Math.max(1, listState.pageSize)));
    if (listState.page < totalPages - 1) {
      listState.page += 1;
      void loadList();
    }
  });

  const csvBtn = optionalElement<HTMLButtonElement>(root, '[data-action="csv"]');
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      if (!lastItems.length) {
        showError(noRecordsLabel);
        return;
      }
      exportCSV(lastItems, getActiveTenantId());
    });
  }

  createBtn.addEventListener('click', async () => {
    const tenantId = getActiveTenantId();
    tenantInput.value = tenantId;
    if (!tenantId) {
      showError(t('tenantSelectRequired') || 'Tenant gerekli');
      return;
    }
    const companyId = companyIdInput.value.trim();
    const legalName = nameInput.value.trim();
    const address = addressInput.value.trim();
    if (!requireFields([
      { value: companyId, message: t('companyIdRequired') },
      { value: legalName, message: t('legalNameRequired') },
      { value: address, message: t('addressRequired') }
    ])) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const response = (await createCompany(tenantId, {
        companyId,
        legalName,
        address
      })) as MutationResponse;
      if (!response.ok) {
        showError(response.error || t('companyCreateFailed'));
        return;
      }
      companyIdInput.value = '';
      nameInput.value = '';
      addressInput.value = '';
      const newId = response.company?.companyId ?? null;
      listState.page = 0;
      listState.query = searchInput.value.trim();
      await loadList(newId);
    } finally {
      setBusy(createBtn, false);
    }
  });

  loadList().catch((error) => console.error(error));

  async function loadList(selectId?: string | null) {
    const tenantId = getActiveTenantId();
    tenantInput.value = tenantId;
    listState.query = searchInput.value.trim();
    detailEl.innerHTML = '';
    if (!tenantId) {
      const message = t('tenantIdRequired');
      showError(message);
      listEl.innerHTML = `<div class="empty">${esc(t('enterTenantId'))}</div>`;
      lastItems = [];
      setPaginationIdle();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TENANT, tenantId);
    } catch {}
    listEl.innerHTML = `<div class="empty">${esc(loadingLabel)}</div>`;
    setPaginationLoading();
    try {
      const response = (await listCompanies(tenantId, {
        query: listState.query,
        page: listState.page,
        pageSize: listState.pageSize,
        sort: listState.sort,
        order: listState.order
      })) as ListResponse;
      if (!response.ok) {
        const message = response.error || t('errorGeneric');
        showError(message);
        listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        setPaginationIdle();
        return;
      }
      const items = response.items ?? [];
      lastItems = items;
      if (typeof response.total === 'number' && response.total >= 0) {
        listState.total = response.total;
      } else {
        listState.total = items.length;
      }
      if (typeof response.pageSize === 'number' && response.pageSize > 0) {
        listState.pageSize = response.pageSize;
      }
      if (typeof response.page === 'number' && response.page >= 0) {
        listState.page = response.page;
      }
      if (isCompanySortKey(response.sort)) {
        listState.sort = response.sort;
        sortSelect.value = listState.sort;
      }
      const orderValue = response.order === 'desc' ? 'desc' : response.order === 'asc' ? 'asc' : listState.order;
      if (orderValue !== listState.order) {
        listState.order = orderValue;
        applyOrderToggleVisual();
      }
      try {
        localStorage.setItem(
          stateKey,
          JSON.stringify({
            tenantId,
            search: listState.query,
            page: listState.page,
            sort: listState.sort,
            order: listState.order
          })
        );
      } catch {}
      if (!items.length) {
        state.selectedId = null;
        listEl.innerHTML = `<div class="empty">${esc(noRecordsLabel)}</div>`;
        detailEl.innerHTML = `<div class="empty">${esc(selectRecordLabel)}</div>`;
        updatePaginationControls(0);
        return;
      }
      if (selectId) {
        state.selectedId = selectId;
      } else if (!state.selectedId || !items.some((item) => item.companyId === state.selectedId)) {
        state.selectedId = items[0].companyId;
      }
      listEl.innerHTML = items
        .map((item) => {
          const isActive = item.companyId === state.selectedId;
          const metrics = metricsForItem(item);
          const statusLine = `${esc(item.companyId)} • ${esc(item.address)}${
            item.status ? ` • ${esc(item.status)}` : ''
          }`;
          return `
            <button class="list-item ${isActive ? 'active' : ''}" data-id="${item.companyId}">
              <div class="title">${esc(item.legalName)}</div>
              <div class="meta">${statusLine}</div>
              ${metrics ? `<div class="meta stats">${metrics}</div>` : ''}
            </button>
          `;
        })
        .join('');

      listEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          state.selectedId = btn.dataset.id ?? null;
          listEl.querySelectorAll('button[data-id]').forEach((node) => node.classList.toggle('active', node === btn));
          if (state.selectedId) {
            await showDetail(state.selectedId);
          } else {
            detailEl.innerHTML = `<div class="empty">${esc(selectRecordLabel)}</div>`;
          }
        });
      });
      updatePaginationControls(items.length);

      if (state.selectedId) {
        await showDetail(state.selectedId);
      }
    } catch (error) {
      console.error(error);
      const message = t('companyListFailed');
      showError(message);
      listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
      lastItems = [];
      setPaginationIdle();
    }
  }

  async function showDetail(id: string) {
    const tenantId = getActiveTenantId();
    tenantInput.value = tenantId;
    if (!tenantId) {
      const message = t('tenantIdRequired');
      showError(message);
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
      return;
    }
    detailEl.innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
    try {
      const response = (await getCompany(id, tenantId)) as DetailResponse;
      if (!response.ok || !response.company) {
        const message = response.error || t('companyNotFound');
        showError(message);
        detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      renderDetail(response.company, tenantId);
    } catch (error) {
      console.error(error);
      const message = t('companyDetailLoadFailed');
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
      showError(message);
    }
  }

  function renderDetail(company: CompanyDetail, tenantId: string) {
    detailEl.innerHTML = getDetailTemplate(company);

    const saveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const deleteBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="delete"]');

    saveBtn.addEventListener('click', async () => {
      const payload = {
        legalName: valueOf<HTMLInputElement>(detailEl, '#companies-detail-name'),
        address: valueOf<HTMLInputElement>(detailEl, '#companies-detail-address'),
        status: valueOf<HTMLSelectElement>(detailEl, '#companies-detail-status') || 'Active'
      };
      if (!requireFields([
        { value: payload.legalName, message: t('legalNameRequired') },
        { value: payload.address, message: t('addressRequired') }
      ])) {
        return;
      }
      setBusy(saveBtn, true);
      try {
        const response = (await updateCompany(company.companyId, tenantId, payload)) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyUpdateFailed'));
          return;
        }
        await refreshDetail(company.companyId, tenantId);
        await loadList(company.companyId);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('companyDeleteConfirm') ?? 'Delete this company?')) return;
      setBusy(deleteBtn, true);
      try {
        const response = (await deleteCompany(company.companyId, tenantId)) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyDeleteFailed'));
          return;
        }
        state.selectedId = null;
        detailEl.innerHTML = `<div class="empty">${esc(t('companyDeleted'))}</div>`;
        await loadList();
      } finally {
        setBusy(deleteBtn, false);
      }
    });

    wireOfficerSection(company, tenantId);
    wireShareholderSection(company, tenantId);
    wireDocumentSection(company, tenantId);
    wirePermitSection(company, tenantId);
  }

  async function refreshDetail(id: string, tenantId: string) {
    try {
      const response = (await getCompany(id, tenantId)) as DetailResponse;
      if (response.ok && response.company) {
        renderDetail(response.company, tenantId);
      }
    } catch (error) {
      console.error(error);
    }
  }

  function wireOfficerSection(company: CompanyDetail, tenantId: string) {
    const section = optionalElement<HTMLElement>(detailEl, '[data-section="officers"]');
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeOfficer(company.companyId, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = optionalElement<HTMLButtonElement>(section, '[data-action="add-officer"]');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
      const type = valueOf<HTMLInputElement>(section, '#officer-type');
      const userId = emptyToNull(valueOf<HTMLInputElement>(section, '#officer-user'));
      const validFrom = emptyToNull(valueOf<HTMLInputElement>(section, '#officer-from'));
      const validTo = emptyToNull(valueOf<HTMLInputElement>(section, '#officer-to'));
      if (!requireFields([{ value: type, message: t('typeRequired') }])) {
        return;
      }
      setBusy(addBtn, true);
      try {
        const response = (await addOfficer(company.companyId, tenantId, {
          type,
          userId,
          validFrom,
          validTo
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.companyId, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }

  function wireShareholderSection(company: CompanyDetail, tenantId: string) {
    const section = optionalElement<HTMLElement>(detailEl, '[data-section="shareholders"]');
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeShareholder(company.companyId, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = optionalElement<HTMLButtonElement>(section, '[data-action="add-shareholder"]');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
      const personName = valueOf<HTMLInputElement>(section, '#shareholder-name');
      const roleType = valueOf<HTMLInputElement>(section, '#shareholder-role');
      const percentRaw = valueOf<HTMLInputElement>(section, '#shareholder-percent');
      if (!requireFields([
        { value: personName, message: t('personNameRequired') },
        { value: roleType, message: t('roleTypeRequired') }
      ])) {
        return;
      }
      const percent = percentRaw === '' ? null : Number(percentRaw);
      if (percentRaw !== '' && Number.isNaN(percent)) {
        showError(t('percentMustBeNumber'));
        return;
      }
      setBusy(addBtn, true);
      try {
        const response = (await addShareholder(company.companyId, tenantId, {
          personName,
          roleType,
          percent
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.companyId, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }

  function wireDocumentSection(company: CompanyDetail, tenantId: string) {
    const section = optionalElement<HTMLElement>(detailEl, '[data-section="documents"]');
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeCompanyDoc(company.companyId, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = optionalElement<HTMLButtonElement>(section, '[data-action="add-document"]');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
      const title = valueOf<HTMLInputElement>(section, '#document-title');
      const docType = valueOf<HTMLInputElement>(section, '#document-type');
      const url = emptyToNull(valueOf<HTMLInputElement>(section, '#document-url'));
      const metaRaw = valueOf<HTMLTextAreaElement>(section, '#document-meta');
      if (!requireFields([
        { value: title, message: t('titleRequired') },
        { value: docType, message: t('docTypeRequired') }
      ])) {
        return;
      }
      let metaJson: unknown = null;
      if (metaRaw.trim()) {
        try {
          metaJson = JSON.parse(metaRaw);
        } catch (error) {
          showError(t('metaJsonInvalid'));
          return;
        }
      }
      setBusy(addBtn, true);
      try {
        const response = (await addCompanyDoc(company.companyId, tenantId, {
          title,
          docType,
          url,
          metaJson
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.companyId, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }

  function wirePermitSection(company: CompanyDetail, tenantId: string) {
    const section = optionalElement<HTMLElement>(detailEl, '[data-section="permits"]');
    if (!section) return;

    const permitMap = new Map<string, CompanyPermit>((company.permits ?? []).map((permit) => [permit.id, permit]));

    const createBtn = optionalElement<HTMLButtonElement>(section, '[data-action="create-permit"]');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const type = valueOf<HTMLInputElement>(section, '#permit-type');
        if (!type) {
          showError(t('permitTypeRequired') || 'Permit type required');
          return;
        }
        const authority = emptyToNull(valueOf<HTMLInputElement>(section, '#permit-authority'));
        const reference = emptyToNull(valueOf<HTMLInputElement>(section, '#permit-reference'));
        const registered = emptyToNull(valueOf<HTMLInputElement>(section, '#permit-registered'));
        const effective = emptyToNull(valueOf<HTMLInputElement>(section, '#permit-effective'));
        const valid = emptyToNull(valueOf<HTMLInputElement>(section, '#permit-valid'));
        const capacityRaw = valueOf<HTMLInputElement>(section, '#permit-capacity');
        let capacityValue: number | null = null;
        if (capacityRaw) {
          const parsed = Number(capacityRaw);
          if (Number.isNaN(parsed)) {
            showError(t('capacityMustBeNumber') || 'Capacity must be a number');
            return;
          }
          if (parsed < 0 || parsed > 9) {
            showError(t('capacityRangeError') || 'Capacity must be between 0 and 9');
            return;
          }
          capacityValue = parsed;
        }
        const scoped = checked(section, '#permit-scoped');
        const status = valueOf<HTMLSelectElement>(section, '#permit-status') || 'Active';
        setBusy(createBtn, true);
        try {
          const response = (await createPermit(company.companyId, tenantId, {
            companyId: company.companyId,
            permitType: type,
            issuingAuthority: authority,
            referenceNo: reference,
            permitRegisteredOn: registered,
            effectiveFrom: effective,
            validUntil: valid,
            capacityPkw: capacityValue,
            vehicleScoped: scoped,
            status
          })) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('permitCreateFailed') || 'Permit creation failed');
            return;
          }
          const typeInputEl = section.querySelector('#permit-type') as HTMLInputElement | null;
          if (typeInputEl) typeInputEl.value = '';
          const authorityInputEl = section.querySelector('#permit-authority') as HTMLInputElement | null;
          if (authorityInputEl) authorityInputEl.value = '';
          const referenceInputEl = section.querySelector('#permit-reference') as HTMLInputElement | null;
          if (referenceInputEl) referenceInputEl.value = '';
          const registeredInputEl = section.querySelector('#permit-registered') as HTMLInputElement | null;
          if (registeredInputEl) registeredInputEl.value = '';
          const effectiveInputEl = section.querySelector('#permit-effective') as HTMLInputElement | null;
          if (effectiveInputEl) effectiveInputEl.value = '';
          const validInputEl = section.querySelector('#permit-valid') as HTMLInputElement | null;
          if (validInputEl) validInputEl.value = '';
          const capacityInputEl = section.querySelector('#permit-capacity') as HTMLInputElement | null;
          if (capacityInputEl) capacityInputEl.value = '';
          const scopedInput = section.querySelector('#permit-scoped') as HTMLInputElement | null;
          if (scopedInput) scopedInput.checked = false;
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(createBtn, false);
        }
      });
    }

    section.querySelectorAll<HTMLButtonElement>('[data-action="add-permit-event"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const permitId = btn.dataset.permit;
        if (!permitId) return;
        const form = section.querySelector(`[data-permit-form="${permitId}"]`) as HTMLElement | null;
        if (!form) return;
        const eventType = valueOf<HTMLSelectElement>(form, 'select[data-event-type]');
        const eventDate = valueOf<HTMLInputElement>(form, 'input[data-event-date]');
        if (!eventType) {
          showError(t('eventTypeRequired') || 'Event type required');
          return;
        }
        if (!eventDate) {
          showError(t('eventDateRequired') || 'Event date required');
          return;
        }
        const referenceNo = emptyToNull(valueOf<HTMLInputElement>(form, 'input[data-event-ref]'));
        const sourceDocRef = emptyToNull(valueOf<HTMLInputElement>(form, 'input[data-event-doc]'));
        setBusy(btn, true);
        try {
          const response = (await addPermitEvent(company.companyId, permitId, tenantId, {
            companyId: company.companyId,
            eventType,
            eventDate,
            referenceNo,
            sourceDocRef
          })) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('permitEventFailed') || 'Permit event failed');
            return;
          }
          const eventDateInput = form.querySelector('input[data-event-date]') as HTMLInputElement | null;
          if (eventDateInput) eventDateInput.value = '';
          const eventRefInput = form.querySelector('input[data-event-ref]') as HTMLInputElement | null;
          if (eventRefInput) eventRefInput.value = '';
          const eventDocInput = form.querySelector('input[data-event-doc]') as HTMLInputElement | null;
          if (eventDocInput) eventDocInput.value = '';
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    section.querySelectorAll<HTMLButtonElement>('[data-action="add-permit-vehicle"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const permitId = btn.dataset.permit;
        if (!permitId) return;
        const permit = permitMap.get(permitId);
        if (!permit) return;
        const form = section.querySelector(`[data-vehicle-form="${permitId}"]`) as HTMLElement | null;
        if (!form) return;
        if (typeof permit.capacityPkw === 'number') {
          const activeCount = (permit.vehicleAuthorizations ?? []).filter((auth) => !auth.revokedOn).length;
          if (activeCount >= permit.capacityPkw) {
            showError(t('vehicleCapacityExceeded') || 'Capacity reached');
            return;
          }
        }
        const vin = valueOf<HTMLInputElement>(form, 'input[data-auth-vin]').toUpperCase();
        if (!vin) {
          showError(t('vinRequired') || 'VIN is required');
          return;
        }
        const vehicleId = emptyToNull(valueOf<HTMLInputElement>(form, 'input[data-auth-vehicle]'));
        if (permit.vehicleScoped && !vehicleId) {
          showError(t('vehicleIdRequired') || 'Vehicle ID required');
          return;
        }
        const authorizedOnValue = emptyToNull(valueOf<HTMLInputElement>(form, 'input[data-auth-date]'));
        setBusy(btn, true);
        try {
          const response = (await createPermitVehicle(company.companyId, permitId, tenantId, {
            companyId: company.companyId,
            vehicleId: vehicleId ?? undefined,
            vin,
            authorizedOn: authorizedOnValue ?? undefined
          })) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('vehicleCreateFailed') || 'Failed to authorize vehicle');
            return;
          }
          const vinInput = form.querySelector('input[data-auth-vin]') as HTMLInputElement | null;
          if (vinInput) vinInput.value = '';
          const vehicleInput = form.querySelector('input[data-auth-vehicle]') as HTMLInputElement | null;
          if (vehicleInput) vehicleInput.value = '';
          const dateInput = form.querySelector('input[data-auth-date]') as HTMLInputElement | null;
          if (dateInput) dateInput.value = '';
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    section.querySelectorAll<HTMLButtonElement>('[data-action="revoke-permit-vehicle"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const permitId = btn.dataset.permit;
        const authorizationId = btn.dataset.authorization;
        if (!permitId || !authorizationId) return;
        if (!confirm(t('vehicleRevokeConfirm') || 'Revoke this authorization?')) return;
        setBusy(btn, true);
        try {
          const response = (await revokePermitVehicle(company.companyId, permitId, authorizationId, tenantId, {})) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('vehicleDeleteFailed') || 'Failed to revoke authorization');
            return;
          }
          await refreshDetail(company.companyId, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });
  }
}

function getShell(labels: { paginationPrev: string; paginationNext: string; paginationIdle: string }) {
  const tenantLabel = t('tenantId') ?? 'tenantId';
  const searchLabel = t('search') ?? 'Search';
  const reloadLabel = t('reload') ?? 'Reload';
  const exportLabel = t('export') ?? 'Export';
  const createLabel = t('create') ?? 'Create';
  const sortLabel = t('sort') ?? 'Sort';
  const orderTitleAsc = translateOrFallback('tenantSortAscending', 'Ascending');
  const sortOptionsMarkup = COMPANY_SORT_OPTIONS.map((option) => {
    const label = t(option.labelKey);
    const text = label && label !== option.labelKey ? label : option.fallback;
    return `<option value="${option.value}"${option.value === 'name' ? ' selected' : ''}>${esc(text)}</option>`;
  }).join('');
  return `
    <div class="companies-wrap">
      <div class="controls">
        <label class="label">${esc(tenantLabel)}</label>
        <input id="companies-tenant" class="input" placeholder="${esc(tenantLabel)}" />
        <label class="label">${esc(searchLabel)}</label>
        <div class="search-row">
          <input id="companies-search" class="input" placeholder="${esc(searchLabel)}" />
          <button class="btn" data-action="refresh">${esc(reloadLabel)}</button>
          <button class="btn" data-action="csv">${esc(exportLabel)}</button>
        </div>
        <div class="search-row" style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <label class="label" style="margin:0">${esc(sortLabel)}</label>
          <select id="companies-sort" class="input" style="flex:1">
            ${sortOptionsMarkup}
          </select>
          <button class="btn" id="companies-order-toggle" data-order="asc" title="${esc(orderTitleAsc)}" aria-label="${esc(orderTitleAsc)}">${esc(ORDER_ICONS.asc)}</button>
        </div>
        <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#475569">
          <div id="companies-pagination-info" class="meta">${esc(labels.paginationIdle)}</div>
          <div style="display:flex;gap:8px">
            <button class="btn" id="companies-page-prev" disabled>${esc(labels.paginationPrev)}</button>
            <button class="btn" id="companies-page-next" disabled>${esc(labels.paginationNext)}</button>
          </div>
        </div>
        <div class="create-row">
          <input id="companies-create-id" class="input" placeholder="${esc(t('companyId') ?? 'Company ID')}" />
          <input id="companies-create-name" class="input" placeholder="${esc(t('legalName') ?? 'Legal name')}" />
          <input id="companies-create-address" class="input" placeholder="${esc(t('address') ?? 'Address')}" />
          <button class="btn primary" data-action="create">${esc(createLabel)}</button>
        </div>
      </div>
      <div class="content">
        <div class="list" data-role="list"></div>
        <div class="detail" data-role="detail"></div>
      </div>
    </div>
  `;
}

function getDetailTemplate(company: CompanyDetail) {
  const officers = company.officers ?? [];
  const shareholders = company.shareholders ?? [];
  const documents = company.documents ?? [];
  const permits = company.permits ?? [];
  const permitEvents = company.permitEvents ?? [];
  const statuses = [
    { value: 'Active', label: t('statusActive') || 'Active' },
    { value: 'Ruhend', label: t('statusRuhend') || 'Ruhend' },
    { value: 'Gelöscht', label: t('statusDeleted') || 'Gelöscht' }
  ];
  const eventsByPermit = new Map<string, CompanyPermitEvent[]>();
  permitEvents.forEach((event) => {
    const key = event.permitId || '__unlinked__';
    if (!eventsByPermit.has(key)) {
      eventsByPermit.set(key, []);
    }
    eventsByPermit.get(key)!.push(event);
  });
  const permitEventOptions = [
    { value: 'REGISTERED', label: t('permitEventRegistered') || 'Registered' },
    { value: 'ACTIVE', label: t('permitEventActive') || 'Active' },
    { value: 'RUHEND', label: t('permitEventRuhend') || 'Ruhend' },
    { value: 'WIEDERBETRIEB', label: t('permitEventWiederbetrieb') || 'Wiederbetrieb' },
    { value: 'GELOESCHT', label: t('permitEventGeloescht') || 'Gelöscht' }
  ];
  const eventOptionsMarkup = permitEventOptions
    .map(({ value, label }) => `<option value="${value}">${esc(label)}</option>`)
    .join('');
  const permitsMarkup = permits.length
    ? permits
        .map((permit) => {
          const permitEventsList = eventsByPermit.get(permit.id) ?? [];
          const vehicleAuthorizations = permit.vehicleAuthorizations ?? [];
          const activeAuthorizations = vehicleAuthorizations.filter((auth) => !auth.revokedOn);
          const capacityDisplay = typeof permit.capacityPkw === 'number'
            ? `${activeAuthorizations.length}/${permit.capacityPkw}`
            : `${activeAuthorizations.length}`;
          const authorizationsMarkup = vehicleAuthorizations.length
            ? vehicleAuthorizations
                .map((authorization) => `
                    <div class="item-row">
                      <div>
                        <div class="title">${esc(authorization.vin)}</div>
                        <div class="meta">${esc(t('authorizedOn') || 'Authorized on')}: ${formatDate(authorization.authorizedOn)}</div>
                        <div class="meta">
                          ${authorization.revokedOn
                            ? `${esc(t('authorizationRevoked') || 'Revoked')} • ${formatDate(authorization.revokedOn)}`
                            : esc(t('statusActive') || 'Active')}
                        </div>
                      </div>
                      ${authorization.revokedOn ? '' : `<button class="btn danger" data-action="revoke-permit-vehicle" data-permit="${permit.id}" data-authorization="${authorization.id}">${esc(t('revoke') || 'Revoke')}</button>`}
                    </div>
                  `)
                .join('')
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
          const permitScopedHint = permit.vehicleScoped ? `<div class="hint">${esc(t('vehicleScopedHint') || 'Vehicle ID required')}</div>` : '';
          const eventsMarkup = permitEventsList.length
            ? permitEventsList
                .map(
                  (event) => `
                      <div class="meta">
                        <span>${esc(translateEventType(event.eventType))}</span>
                        <span> • ${formatDate(event.eventDate)}</span>
                        ${event.referenceNo ? `<span> • ${esc(event.referenceNo)}</span>` : ''}
                        ${event.sourceDocRef ? `<span> • ${esc(event.sourceDocRef)}</span>` : ''}
                      </div>
                    `
                )
                .join('')
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
          return `
            <div class="item-row column" data-permit="${permit.id}">
              <div>
                <div class="title">${esc(permit.permitType)}</div>
                <div class="meta">${esc(t('status') || 'Status')}: ${esc(translateStatus(permit.status))}</div>
                <div class="meta">${esc(t('issuingAuthority') || 'Authority')}: ${esc(permit.issuingAuthority ?? '—')}</div>
                <div class="meta">${esc(t('referenceNo') || 'Reference')}: ${esc(permit.referenceNo ?? '—')}</div>
                <div class="meta">${esc(t('permitRegisteredOn') || 'Registered on')}: ${formatDate(permit.permitRegisteredOn)}</div>
                <div class="meta">${esc(t('effectiveFrom') || 'Effective from')}: ${formatDate(permit.effectiveFrom)}</div>
                <div class="meta">${esc(t('validUntil') || 'Valid until')}: ${formatDate(permit.validUntil)}</div>
                <div class="meta">${esc(t('capacityPkw') || 'Capacity')}: ${permit.capacityPkw ?? '—'}</div>
                <div class="meta">${esc(t('vehicleScoped') || 'Vehicle scoped')}: ${permit.vehicleScoped ? esc(t('yes') || 'Yes') : esc(t('no') || 'No')}</div>
                <div class="meta">${esc(t('permitCapacityUsage') || 'Active vehicles')}: ${esc(capacityDisplay)}</div>
              </div>
              <div class="list-block" data-role="permit-authorizations">
                <h5>${esc(t('permitAuthorizedVehicles') || 'Authorized vehicles')}</h5>
                ${authorizationsMarkup}
              </div>
              <div class="form-row wrap" data-vehicle-form="${permit.id}">
                <input class="input" data-auth-vin placeholder="${esc(t('vin') || 'VIN')}" />
                <input class="input" data-auth-vehicle placeholder="${esc(t('vehicleId') || 'Vehicle ID')}" />
                <input class="input" type="date" data-auth-date />
                <button class="btn" data-action="add-permit-vehicle" data-permit="${permit.id}">${esc(t('authorizeVehicle') || 'Authorize')}</button>
              </div>
              ${permitScopedHint}
              <div class="permit-events" data-role="permit-events">
                ${eventsMarkup}
              </div>
              <div class="form-row wrap" data-permit-form="${permit.id}">
                <select data-event-type>${eventOptionsMarkup}</select>
                <input type="date" data-event-date />
                <input class="input" data-event-ref placeholder="${esc(t('referenceNo') || 'Reference')}" />
                <input class="input" data-event-doc placeholder="${esc(t('sourceDocRef') || 'Source doc')}" />
                <button class="btn" data-action="add-permit-event" data-permit="${permit.id}">${esc(t('addEvent') || 'Add event')}</button>
              </div>
            </div>
          `;
        })
        .join('')
    : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
  const unlinkedEvents = eventsByPermit.get('__unlinked__') ?? [];
  const unlinkedMarkup = unlinkedEvents.length
    ? `
        <div class="list-block unlinked-events">
          <h5>${esc(t('permitEventsUnlinked') || 'Events without permit')}</h5>
          ${unlinkedEvents
            .map(
              (event) => `
                <div class="meta">
                  <span>${esc(translateEventType(event.eventType))}</span>
                  <span> • ${formatDate(event.eventDate)}</span>
                  ${event.referenceNo ? `<span> • ${esc(event.referenceNo)}</span>` : ''}
                  ${event.sourceDocRef ? `<span> • ${esc(event.sourceDocRef)}</span>` : ''}
                </div>
              `
            )
            .join('')}
        </div>
      `
    : '';
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(company.legalName)}</h3>
          <div class="meta">${esc(company.companyId)} • ${esc(company.address)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save'))}</button>
          <button class="btn danger" data-action="delete">${esc(t('delete'))}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('companyId') || 'Company ID')}</label>
        <input id="companies-detail-id" class="input" value="${esc(company.companyId)}" readonly />
        <label class="label">${esc(t('legalName') || 'Legal name')}</label>
        <input id="companies-detail-name" class="input" value="${esc(company.legalName)}" />
        <label class="label">${esc(t('address') || 'Address')}</label>
        <input id="companies-detail-address" class="input" value="${esc(company.address)}" />
        <label class="label">${esc(t('status') || 'Status')}</label>
        <select id="companies-detail-status" class="input">
          ${statuses
            .map(({ value, label }) => `<option value="${value}" ${company.status === value ? 'selected' : ''}>${esc(label)}</option>`)
            .join('')}
        </select>
      </div>
      <section data-section="officers">
        <h4>${esc(t('officers'))}</h4>
        <div class="list-block">
          ${officers.length
            ? officers
                .map(
                  (officer) => `
                      <div class="item-row">
                        <div>
                          <div class="title">${esc(officer.type)}</div>
                          <div class="meta">${officer.userId ? `${esc(t('userId') || 'user')}: ${esc(officer.userId)}` : '—'}</div>
                          <div class="meta">${formatDate(officer.validFrom)} → ${formatDate(officer.validTo)}</div>
                        </div>
                        <button class="btn" data-remove="${officer.id}">${esc(t('delete'))}</button>
                      </div>
                    `
                )
                .join('')
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`}
        </div>
        <div class="form-row">
          <input id="officer-type" class="input" placeholder="${esc(t('type') || 'Type')}" />
          <input id="officer-user" class="input" placeholder="${esc(t('userId') || 'User ID')}" />
          <input id="officer-from" class="input" type="date" />
          <input id="officer-to" class="input" type="date" />
          <button class="btn" data-action="add-officer">${esc(t('add') || 'Add')}</button>
        </div>
      </section>
      <section data-section="shareholders">
        <h4>${esc(t('shareholders'))}</h4>
        <div class="list-block">
          ${shareholders.length
            ? shareholders
                .map(
                  (holder) => `
                      <div class="item-row">
                        <div>
                          <div class="title">${esc(holder.personName)}</div>
                          <div class="meta">${esc(holder.roleType)}</div>
                          <div class="meta">${holder.percent ?? '—'}%</div>
                        </div>
                        <button class="btn" data-remove="${holder.id}">${esc(t('delete'))}</button>
                      </div>
                    `
                )
                .join('')
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`}
        </div>
        <div class="form-row">
          <input id="shareholder-name" class="input" placeholder="${esc(t('personName') || 'Name')}" />
          <input id="shareholder-role" class="input" placeholder="${esc(t('roleType') || 'Role type')}" />
          <input id="shareholder-percent" class="input" placeholder="${esc(t('percent') || 'Percent')}" type="number" />
          <button class="btn" data-action="add-shareholder">${esc(t('add') || 'Add')}</button>
        </div>
      </section>
      <section data-section="documents">
        <h4>${esc(t('documents') || t('docs') || 'Documents')}</h4>
        <div class="list-block">
          ${documents.length
            ? documents
                .map(
                  (doc) => `
                      <div class="item-row">
                        <div>
                          <div class="title">${esc(doc.title)}</div>
                          <div class="meta">${esc(doc.docType)}${doc.url ? ` • ${esc(doc.url)}` : ''}</div>
                          <div class="meta">${formatMeta(doc.metaJson)}</div>
                        </div>
                        <button class="btn" data-remove="${doc.id}">${esc(t('delete'))}</button>
                      </div>
                    `
                )
                .join('')
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`}
        </div>
        <div class="form-row column">
          <div class="row">
            <input id="document-title" class="input" placeholder="${esc(t('title') || 'Title')}" />
            <input id="document-type" class="input" placeholder="${esc(t('docType') || 'Document type')}" />
            <input id="document-url" class="input" placeholder="URL" />
          </div>
          <textarea id="document-meta" class="input" placeholder='metaJson (e.g. {"key":"value"})'></textarea>
          <button class="btn" data-action="add-document">${esc(t('add') || 'Add')}</button>
        </div>
      </section>
      <section data-section="permits">
        <h4>${esc(t('permits') || 'Permits')}</h4>
        <div class="list-block">
          ${permitsMarkup}
        </div>
        ${unlinkedMarkup}
        <div class="form-row column permit-create" data-form="create-permit">
          <div class="row">
            <input id="permit-type" class="input" placeholder="${esc(t('permitType') || 'Permit type')}" />
            <input id="permit-authority" class="input" placeholder="${esc(t('issuingAuthority') || 'Authority')}" />
            <input id="permit-reference" class="input" placeholder="${esc(t('referenceNo') || 'Reference')}" />
          </div>
          <div class="row">
            <label class="label">${esc(t('permitRegisteredOn') || 'Registered on')}</label>
            <input id="permit-registered" class="input" type="date" />
            <label class="label">${esc(t('effectiveFrom') || 'Effective from')}</label>
            <input id="permit-effective" class="input" type="date" />
            <label class="label">${esc(t('validUntil') || 'Valid until')}</label>
            <input id="permit-valid" class="input" type="date" />
          </div>
          <div class="row">
            <input id="permit-capacity" class="input" type="number" min="0" max="9" placeholder="${esc(t('capacityPkw') || 'Capacity')}" />
            <label class="checkbox"><input type="checkbox" id="permit-scoped" /> ${esc(t('vehicleScoped') || 'Vehicle scoped')}</label>
            <select id="permit-status" class="input">
              ${statuses
                .map(({ value, label }) => `<option value="${value}" ${value === 'Active' ? 'selected' : ''}>${esc(label)}</option>`)
                .join('')}
            </select>
          </div>
          <button class="btn" data-action="create-permit">${esc(t('createPermit') || t('create') || 'Create')}</button>
        </div>
      </section>
    </div>
  `;
}

function translateStatus(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'ruhend') return t('statusRuhend') || 'Ruhend';
  if (normalized === 'gelöscht' || normalized === 'geloescht') return t('statusDeleted') || 'Gelöscht';
  return t('statusActive') || 'Active';
}

function translateEventType(eventType?: string | null) {
  const normalized = (eventType || '').toUpperCase();
  switch (normalized) {
    case 'REGISTERED':
      return t('permitEventRegistered') || 'Registered';
    case 'ACTIVE':
      return t('permitEventActive') || 'Active';
    case 'RUHEND':
      return t('permitEventRuhend') || 'Ruhend';
    case 'WIEDERBETRIEB':
      return t('permitEventWiederbetrieb') || 'Wiederbetrieb';
    case 'GELOESCHT':
    case 'GELÖSCHT':
      return t('permitEventGeloescht') || 'Gelöscht';
    default:
      return normalized || '-';
  }
}

function formatDate(value?: string | null) {
  return value ? esc(value.slice(0, 10)) : '—';
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

function formatMeta(meta: unknown): string {
  if (meta === null || meta === undefined) {
    return esc(t('metaJsonMissing') || 'metaJson missing');
  }
  if (typeof meta === 'string') {
    const trimmed = meta.trim();
    return trimmed ? esc(trimmed) : esc(t('metaJsonMissing') || 'metaJson missing');
  }
  try {
    return esc(JSON.stringify(meta));
  } catch (error) {
    return esc(String(meta));
  }
}

function valueOf<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(root: ParentNode, selector: string): string {
  const el = root.querySelector(selector) as T | null;
  return el ? el.value.trim() : '';
}

function checked(root: ParentNode, selector: string): boolean {
  const el = root.querySelector(selector) as HTMLInputElement | null;
  return !!el?.checked;
}

function emptyToNull(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  return normalized ? normalized : null;
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

function exportCSV(items: CompanyListItem[], tenantId: string) {
  try {
    const headers = [
      'companyId',
      'legalName',
      'address',
      'status',
      'permitCount',
      'officerCount',
      'shareholdingCount',
      'vehicleAssignmentCount',
      'driverAssignmentCount'
    ];
    const rows = [headers].concat(
      items.map((item) =>
        [
          item.companyId,
          item.legalName,
          item.address,
          item.status,
          item.permitCount,
          item.officerCount,
          item.shareholdingCount,
          item.vehicleAssignmentCount,
          item.driverAssignmentCount
        ].map((value) => String(value ?? ''))
      )
    );
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `companies_${tenantId || 'export'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    showError(t('errorGeneric') || 'Error');
  }
}
