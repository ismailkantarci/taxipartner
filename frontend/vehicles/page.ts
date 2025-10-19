import { listVehicles, createVehicle, updateVehicle, archiveVehicle, getVehicle } from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import { getActiveTenantId } from '../ui/activeTenant';
import { requireElement, optionalElement } from '../ui/dom';
import { STORAGE_KEY_ACTIVE_TENANT } from '../ui/storageKeys';

type VehicleListItem = {
  vehicleId: string;
  companyId: string;
  companyName?: string | null;
  vin: string;
  plateNo?: string | null;
  seatCount?: number | null;
  usage?: string | null;
  status: string;
  validTo?: string | null;
  updatedAt?: string;
};

type VehicleDetail = VehicleListItem & {
  createdAt?: string;
};

type ListResponse = {
  ok: boolean;
  items?: VehicleListItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string | null;
  order?: string | null;
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
};

type DetailResponse = {
  ok: boolean;
  vehicle?: VehicleDetail;
  error?: string;
};

type ListState = {
  query: string;
  companyId: string;
  status: string;
  page: number;
  pageSize: number;
  total: number;
  sort: string;
  order: 'asc' | 'desc';
};

const STATUS_OPTIONS = ['All', 'Active', 'Maintenance', 'Inactive', 'Archived'] as const;
const USAGE_OPTIONS = ['Taxi', 'Mietwagen'] as const;
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'updated', label: 'Updated' },
  { value: 'vin', label: 'VIN' },
  { value: 'status', label: 'Status' },
  { value: 'usage', label: 'Usage' }
];

const STORAGE_KEY_STATE = 'tp_vehicles_state';
const DEFAULT_PAGE_SIZE = 20;

export async function mountVehiclesPage(root: HTMLElement) {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'vehicles', () => {
      guardPassed = true;
    });
    if (!guardPassed) return;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('vehicles')) return;
    attr.push('vehicles');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }

  const activeTenantId = getActiveTenantId();
  if (!activeTenantId) {
    root.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Önce tenant seçin')}</div>`;
    return;
  }

  root.innerHTML = getShell();

  const tenantInput = requireElement<HTMLInputElement>(root, '#vehicle-tenant');
  tenantInput.value = activeTenantId;
  tenantInput.setAttribute('readonly', 'true');
  tenantInput.style.cursor = 'not-allowed';
  tenantInput.style.backgroundColor = 'rgba(241,245,249,0.6)';
  tenantInput.title = t('tenantLockedHint') || 'Tenant seçimi üstten yapılır';

  const searchInput = requireElement<HTMLInputElement>(root, '#vehicle-search');
  const companyInput = requireElement<HTMLInputElement>(root, '#vehicle-filter-company');
  const statusSelect = requireElement<HTMLSelectElement>(root, '#vehicle-filter-status');
  const sortSelect = requireElement<HTMLSelectElement>(root, '#vehicle-sort');
  const orderToggle = requireElement<HTMLButtonElement>(root, '#vehicle-order-toggle');
  const paginationInfo = requireElement<HTMLSpanElement>(root, '#vehicle-pagination-info');
  const prevBtn = requireElement<HTMLButtonElement>(root, '#vehicle-page-prev');
  const nextBtn = requireElement<HTMLButtonElement>(root, '#vehicle-page-next');
  const listEl = requireElement<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = requireElement<HTMLDivElement>(root, '[data-role="detail"]');
  const refreshBtn = requireElement<HTMLButtonElement>(root, '[data-action="refresh"]');

  const createForm = requireElement<HTMLFormElement>(root, '#vehicle-create-form');
  const createCompanyInput = requireElement<HTMLInputElement>(createForm, '#vehicle-create-company');
  const createVinInput = requireElement<HTMLInputElement>(createForm, '#vehicle-create-vin');
  const createPlateInput = requireElement<HTMLInputElement>(createForm, '#vehicle-create-plate');
  const createSeatInput = requireElement<HTMLInputElement>(createForm, '#vehicle-create-seat');
  const createUsageSelect = requireElement<HTMLSelectElement>(createForm, '#vehicle-create-usage');
  const createStatusSelect = requireElement<HTMLSelectElement>(createForm, '#vehicle-create-status');
  const createBtn = requireElement<HTMLButtonElement>(createForm, '[data-action="create"]');

  const listState: ListState = {
    query: '',
    companyId: '',
    status: 'All',
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    sort: 'updated',
    order: 'desc'
  };

  const selection = { id: null as string | null };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_STATE) || 'null') as
      | { query?: string; companyId?: string; status?: string; page?: number; sort?: string; order?: 'asc' | 'desc' }
      | null;
    if (saved) {
      if (typeof saved.query === 'string') listState.query = saved.query;
      if (typeof saved.companyId === 'string') listState.companyId = saved.companyId;
      if (typeof saved.status === 'string') listState.status = saved.status;
      if (typeof saved.page === 'number' && saved.page >= 0) listState.page = saved.page;
      if (typeof saved.sort === 'string') listState.sort = saved.sort;
      if (saved.order === 'asc' || saved.order === 'desc') listState.order = saved.order;
    }
  } catch {
    // ignore
  }

  searchInput.value = listState.query;
  companyInput.value = listState.companyId;
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
  companyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      listState.companyId = companyInput.value.trim();
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
    listState.companyId = companyInput.value.trim();
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
      companyId: createCompanyInput.value.trim(),
      vin: createVinInput.value.trim(),
      plateNo: createPlateInput.value.trim() || null,
      seatCount: createSeatInput.value.trim() || null,
      usage: createUsageSelect.value || null,
      status: createStatusSelect.value || 'Active'
    };
    if (
      !requireFields([
        { value: payload.companyId, message: t('companyIdRequired') || 'companyId gerekli' },
        { value: payload.vin, message: t('vinRequired') || 'VIN gerekli' }
      ])
    ) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const seatValue = payload.seatCount === null ? null : Number(payload.seatCount);
      const body = {
        ...payload,
        seatCount: payload.seatCount === null ? null : Number.isNaN(seatValue) ? payload.seatCount : seatValue
      };
      const response = (await createVehicle(tenantId, body)) as MutationResponse;
      if (!response.ok) {
        showError(response.error || t('errorGeneric') || 'Error');
        return;
      }
      createVinInput.value = '';
      createPlateInput.value = '';
      createSeatInput.value = '';
      createUsageSelect.value = '';
      createStatusSelect.value = 'Active';
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
          companyId: listState.companyId,
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
      const response = (await listVehicles(tenantId, {
        query: listState.query,
        companyId: listState.companyId || undefined,
        status: listState.status,
        page: listState.page,
        pageSize: listState.pageSize,
        sort: listState.sort,
        order: listState.order
      })) as ListResponse;
      if (!response.ok) {
        const message = response.error || t('errorGeneric') || 'Error';
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
      else if (!nextSelected || !items.some((item) => item.vehicleId === nextSelected)) {
        nextSelected = items[0]?.vehicleId ?? null;
      }
      selection.id = nextSelected;

      listEl.innerHTML = items
        .map((item) => {
          const isActive = item.vehicleId === selection.id;
          const badge = renderStatusBadge(item.status);
          const companyLabel = item.companyName ? `${item.companyName} (${item.companyId})` : item.companyId;
          return `
            <button class="list-item ${isActive ? 'active' : ''}" data-id="${item.vehicleId}">
              <div class="title">${esc(item.vin)}</div>
              <div class="meta">${esc(companyLabel)}</div>
              <div class="meta">${badge} • ${esc(item.plateNo ?? '—')}</div>
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
      const response = (await getVehicle(tenantId, id)) as DetailResponse;
      if (!response.ok || !response.vehicle) {
        const message = response.error || t('errorGeneric') || 'Error';
        showError(message);
        detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      renderDetail(response.vehicle, tenantId);
    } catch (error) {
      console.error(error);
      const message = t('errorGeneric') || 'Error';
      showError(message);
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
    }
  }

  function renderDetail(vehicle: VehicleDetail, tenantId: string) {
    detailEl.innerHTML = getDetailTemplate(vehicle);
    const companyInput = requireElement<HTMLInputElement>(detailEl, '#vehicle-detail-company');
    const vinInput = requireElement<HTMLInputElement>(detailEl, '#vehicle-detail-vin');
    const plateInput = requireElement<HTMLInputElement>(detailEl, '#vehicle-detail-plate');
    const seatInput = requireElement<HTMLInputElement>(detailEl, '#vehicle-detail-seat');
    const usageSelect = requireElement<HTMLSelectElement>(detailEl, '#vehicle-detail-usage');
    const statusSelect = requireElement<HTMLSelectElement>(detailEl, '#vehicle-detail-status');
    const archiveNote = optionalElement<HTMLInputElement>(detailEl, '#vehicle-detail-archive-note');
    const saveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const archiveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="archive"]');

    saveBtn.addEventListener('click', async () => {
      const payload = {
        companyId: companyInput.value.trim(),
        vin: vinInput.value.trim(), // not updating but keep for validation maybe future
        plateNo: plateInput.value.trim() || null,
        seatCount: seatInput.value.trim(),
        usage: usageSelect.value || null,
        status: statusSelect.value || 'Active'
      };
      if (!requireFields([{ value: payload.companyId, message: t('companyIdRequired') || 'companyId gerekli' }])) {
        return;
      }
      const seatValue =
        payload.seatCount === null || payload.seatCount === ''
          ? null
          : Number(payload.seatCount);
      const body = {
        companyId: payload.companyId,
        plateNo: payload.plateNo,
        seatCount:
          payload.seatCount === null || payload.seatCount === ''
            ? null
            : Number.isNaN(seatValue)
            ? payload.seatCount
            : seatValue,
        usage: payload.usage,
        status: payload.status
      };
      setBusy(saveBtn, true);
      try {
        const response = (await updateVehicle(tenantId, vehicle.vehicleId, body)) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('errorGeneric') || 'Error');
          return;
        }
        await loadList(vehicle.vehicleId);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    archiveBtn.addEventListener('click', async () => {
      if (!confirm(t('vehicleArchiveConfirm') || 'Aracı arşivlemek istediğinize emin misiniz?')) return;
      setBusy(archiveBtn, true);
      try {
        const response = (await archiveVehicle(tenantId, vehicle.vehicleId, {
          note: archiveNote?.value?.trim() || null
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('errorGeneric') || 'Error');
          return;
        }
        selection.id = null;
        await loadList();
      } finally {
        setBusy(archiveBtn, false);
      }
    });
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

function renderStatusBadge(status: string): string {
  const label = status || '—';
  return `<span class="badge">${esc(label)}</span>`;
}

function getShell() {
  const title = t('vehicles') || 'Vehicles';
  const searchLabel = t('search') || 'Search';
  const reloadLabel = t('reload') || 'Reload';
  const createLabel = t('create') || 'Create';
  return `
    <div style="padding:16px;font-family:ui-sans-serif;max-width:900px">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(title)}</h2>
      <div class="vehicles-wrap">
        <div class="controls">
          <label class="label">${esc(t('tenantId') || 'Tenant')}</label>
          <input id="vehicle-tenant" class="input" />
          <label class="label">${esc(searchLabel)}</label>
          <div class="search-row">
            <input id="vehicle-search" class="input" placeholder="${esc(searchLabel)}" />
            <button class="btn" data-action="refresh">${esc(reloadLabel)}</button>
          </div>
          <label class="label">${esc(t('companyId') || 'companyId')}</label>
          <input id="vehicle-filter-company" class="input" placeholder="${esc(t('companyId') || 'companyId')}" />
          <label class="label">${esc(t('status') || 'Status')}</label>
          <select id="vehicle-filter-status" class="input">
            ${STATUS_OPTIONS.map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
          </select>
          <div class="search-row" style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <label class="label" style="margin:0">${esc(t('sort') || 'Sort')}</label>
            <select id="vehicle-sort" class="input" style="flex:1">
              ${SORT_OPTIONS.map((option) => `<option value="${option.value}">${esc(t(option.label) || option.label)}</option>`).join('')}
            </select>
            <button class="btn" id="vehicle-order-toggle" data-order="desc">↓</button>
          </div>
          <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#475569">
            <span id="vehicle-pagination-info">—</span>
            <div style="display:flex;gap:8px">
              <button class="btn" id="vehicle-page-prev" disabled>${esc(t('tenantPaginationPrev') || 'Önceki')}</button>
              <button class="btn" id="vehicle-page-next" disabled>${esc(t('tenantPaginationNext') || 'Sonraki')}</button>
            </div>
          </div>
          <form id="vehicle-create-form" style="margin-top:16px">
            <div style="font-weight:600;margin-bottom:8px">${esc(createLabel)}</div>
            <div class="form-row column" style="gap:8px">
              <input id="vehicle-create-company" class="input" placeholder="${esc(t('companyId') || 'companyId')}" />
              <input id="vehicle-create-vin" class="input" placeholder="${esc(t('vin') || 'VIN')}" />
              <input id="vehicle-create-plate" class="input" placeholder="${esc(t('plateNo') || 'Plate')}" />
              <input id="vehicle-create-seat" class="input" placeholder="${esc(t('seatCount') || 'Seats')}" type="number" min="0" max="9" />
              <select id="vehicle-create-usage" class="input">
                <option value="">${esc(t('none') || '—')}</option>
                ${USAGE_OPTIONS.map((usage) => `<option value="${usage}">${esc(usage)}</option>`).join('')}
              </select>
              <select id="vehicle-create-status" class="input">
                ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}">${esc(status)}</option>`).join('')}
              </select>
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

function getDetailTemplate(vehicle: VehicleDetail) {
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(vehicle.vin)}</h3>
          <div class="meta">${esc(t('companyId') || 'companyId')}: ${esc(vehicle.companyId)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save') || 'Kaydet')}</button>
          <button class="btn danger" data-action="archive">${esc(t('archive') || 'Arşivle')}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('companyId') || 'companyId')}</label>
        <input id="vehicle-detail-company" class="input" value="${esc(vehicle.companyId)}" />
        <label class="label">${esc(t('vin') || 'VIN')}</label>
        <input id="vehicle-detail-vin" class="input" value="${esc(vehicle.vin)}" readonly />
        <label class="label">${esc(t('plateNo') || 'Plate')}</label>
        <input id="vehicle-detail-plate" class="input" value="${esc(vehicle.plateNo ?? '')}" />
        <label class="label">${esc(t('seatCount') || 'Seats')}</label>
        <input id="vehicle-detail-seat" class="input" type="number" min="0" max="9" value="${vehicle.seatCount ?? ''}" />
        <label class="label">${esc(t('usage') || 'Usage')}</label>
        <select id="vehicle-detail-usage" class="input">
          <option value="">${esc(t('none') || '—')}</option>
          ${USAGE_OPTIONS.map((usage) => `<option value="${usage}"${vehicle.usage === usage ? ' selected' : ''}>${esc(usage)}</option>`).join('')}
        </select>
        <label class="label">${esc(t('status') || 'Status')}</label>
        <select id="vehicle-detail-status" class="input">
          ${STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => `<option value="${status}"${vehicle.status === status ? ' selected' : ''}>${esc(status)}</option>`).join('')}
        </select>
        <label class="label">${esc(t('note') || 'Not')}</label>
        <input id="vehicle-detail-archive-note" class="input" placeholder="${esc(t('noteOptional') || 'Not (opsiyonel)')}" />
      </div>
      <section style="margin-top:16px">
        <h4>${esc(t('meta') || 'Meta')}</h4>
        <div class="meta">
          <div>${esc(t('status') || 'Status')}: ${esc(vehicle.status)}</div>
          <div>${esc(t('validUntil') || 'Valid until')}: ${esc(vehicle.validTo ?? '—')}</div>
          <div>${esc(t('updatedAt') || 'Updated')}: ${esc(vehicle.updatedAt ?? '—')}</div>
          <div>${esc(t('createdAt') || 'Created')}: ${esc(vehicle.createdAt ?? '—')}</div>
        </div>
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
