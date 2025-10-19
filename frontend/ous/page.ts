import { listOUs, createOU, updateOU, deleteOU, getOU } from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import { getActiveTenantId } from '../ui/activeTenant';
import { requireElement, optionalElement } from '../ui/dom';
import { STORAGE_KEY_ACTIVE_TENANT } from '../ui/storageKeys';

type OUListItem = {
  id: string;
  name: string;
  parentId?: string | null;
  childCount?: number;
};

type OUDetail = {
  id: string;
  name: string;
  parentId?: string | null;
  children?: Array<{ id: string; name: string }>;
};

type ListResponse = {
  ok: boolean;
  items?: OUListItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
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
  ou?: OUDetail;
  error?: string;
  errorCode?: string;
};

type ListState = {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  sort: string;
  order: 'asc' | 'desc';
};

type OUOption = OUListItem & { depth: number };

const DEFAULT_PAGE_SIZE = 25;

const OU_ERROR_I18N: Record<string, string> = {
  TENANT_ID_REQUIRED: 'ous.error.tenantRequired',
  OU_NAME_REQUIRED: 'ous.error.nameRequired',
  OU_PARENT_INVALID: 'ous.error.parentInvalid',
  OU_DELETE_HAS_CHILDREN: 'ous.error.deleteHasChildren',
  OU_NOT_FOUND: 'ous.error.notFound'
};

function ouErrorMessage(code?: string, fallback?: string) {
  if (code) {
    const key = OU_ERROR_I18N[code];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
  }
  return fallback || t('errorGeneric') || 'Error';
}

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

  const activeTenantId = getActiveTenantId();
  if (!activeTenantId) {
    root.innerHTML = `<div class="empty">${esc(t('tenantSelectRequired') || 'Önce tenant seçin')}</div>`;
    return;
  }

  root.innerHTML = getShell();

  const tenantInput = requireElement<HTMLInputElement>(root, '#ou-tenant');
  tenantInput.value = activeTenantId;
  tenantInput.setAttribute('readonly', 'true');
  tenantInput.style.cursor = 'not-allowed';
  tenantInput.style.backgroundColor = 'rgba(241,245,249,0.6)';
  tenantInput.title = t('tenantLockedHint') || 'Tenant seçimi üst menüden yapılır';

  const searchInput = requireElement<HTMLInputElement>(root, '#ou-search');
  const refreshBtn = requireElement<HTMLButtonElement>(root, '[data-action="refresh"]');
  const listEl = requireElement<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = requireElement<HTMLDivElement>(root, '[data-role="detail"]');
  const paginationInfo = requireElement<HTMLSpanElement>(root, '#ou-pagination-info');
  const prevBtn = requireElement<HTMLButtonElement>(root, '#ou-page-prev');
  const nextBtn = requireElement<HTMLButtonElement>(root, '#ou-page-next');
  const createNameInput = requireElement<HTMLInputElement>(root, '#ou-create-name');
  const createParentSelect = requireElement<HTMLSelectElement>(root, '#ou-create-parent');
  const createBtn = requireElement<HTMLButtonElement>(root, '[data-action="create"]');

  const stateKey = 'tp_ou_state';
  const listState: ListState = {
    query: '',
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    sort: 'name',
    order: 'asc'
  };
  const detailState: { selectedId: string | null } = { selectedId: null };

  let parentOptions: OUOption[] = [];

  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || 'null') as
      | { query?: string; page?: number; pageSize?: number }
      | null;
    if (saved) {
      if (typeof saved.query === 'string') listState.query = saved.query;
      if (typeof saved.page === 'number' && saved.page >= 0) listState.page = saved.page;
      if (typeof saved.pageSize === 'number' && saved.pageSize > 0) listState.pageSize = saved.pageSize;
    }
  } catch {
    // ignore parse errors
  }

  searchInput.value = listState.query;

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

  createBtn.addEventListener('click', async () => {
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      showError(t('tenantSelectRequired') || 'Tenant gerekli');
      return;
    }
    const name = createNameInput.value.trim();
    const parentId = createParentSelect.value || null;
    if (!requireFields([{ value: name, message: t('legalNameRequired') || 'Ad gerekli' }])) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const response = (await createOU(tenantId, { name, parentId })) as MutationResponse;
      if (!response.ok) {
        showError(ouErrorMessage(response.errorCode, response.error));
        return;
      }
      createNameInput.value = '';
      createParentSelect.value = '';
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
        stateKey,
        JSON.stringify({ query: listState.query, page: listState.page, pageSize: listState.pageSize })
      );
    } catch {
      // ignore storage errors
    }

    listEl.innerHTML = `<div class="empty">${esc(t('loading') || 'Loading')}</div>`;
    paginationInfo.textContent = t('loading') || 'Loading';
    prevBtn.setAttribute('disabled', 'true');
    nextBtn.setAttribute('disabled', 'true');

    try {
      const [listResponse, parentList] = await Promise.all([
        listOUs(tenantId, {
          query: listState.query,
          page: listState.page,
          pageSize: listState.pageSize,
          sort: listState.sort,
          order: listState.order
        }) as Promise<ListResponse>,
        collectAllOUs(tenantId)
      ]);

      parentOptions = parentList;
      updateParentSelect(createParentSelect, parentOptions);

      if (!listResponse.ok) {
        const message = ouErrorMessage(listResponse.errorCode, listResponse.error);
        showError(message);
        listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        paginationInfo.textContent = '—';
        return;
      }

      const items = listResponse.items ?? [];
      listState.total = listResponse.total ?? items.length;
      listState.pageSize = listResponse.pageSize ?? listState.pageSize;
      listState.page = listResponse.page ?? listState.page;

      const totalPages = Math.max(1, Math.ceil(listState.total / Math.max(1, listState.pageSize)));
      const hasPrev = listState.page > 0;
      const hasNext = listState.page < totalPages - 1;
      if (hasPrev) prevBtn.removeAttribute('disabled');
      else prevBtn.setAttribute('disabled', 'true');
      if (hasNext) nextBtn.removeAttribute('disabled');
      else nextBtn.setAttribute('disabled', 'true');

      if (!items.length) {
        listEl.innerHTML = `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`;
        paginationInfo.textContent = `${listState.total} • ${listState.page + 1}/${totalPages}`;
        detailState.selectedId = null;
        detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord') || 'Kayıt seçin')}</div>`;
        return;
      }

      const parentNameMap = new Map(parentOptions.map((entry) => [entry.id, entry.name]));

      let nextSelectedId: string | null = detailState.selectedId;
      if (selectId) {
        nextSelectedId = selectId;
      } else if (nextSelectedId && !items.some((item) => item.id === nextSelectedId)) {
        nextSelectedId = items[0]?.id ?? null;
      } else if (!nextSelectedId) {
        nextSelectedId = items[0]?.id ?? null;
      }
      detailState.selectedId = nextSelectedId;

      listEl.innerHTML = items
        .map((item) => {
          const isActive = item.id === detailState.selectedId;
          const parentName = item.parentId ? parentNameMap.get(item.parentId) || '—' : '—';
          const childInfo =
            typeof item.childCount === 'number'
              ? `${item.childCount} ${t('children') || 'children'}`
              : '';
          return `
            <button class="list-item ${isActive ? 'active' : ''}" data-id="${item.id}">
              <div class="title">${esc(item.name)}</div>
              <div class="meta">${esc(t('parent') || 'Parent')}: ${esc(parentName)}${childInfo ? ` • ${esc(childInfo)}` : ''}</div>
            </button>
          `;
        })
        .join('');

      paginationInfo.textContent = `${Math.min(
        listState.page * listState.pageSize + 1,
        listState.total
      )}-${Math.min((listState.page + 1) * listState.pageSize, listState.total)} / ${listState.total} • ${
        listState.page + 1
      }/${totalPages}`;

      listEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          detailState.selectedId = btn.dataset.id ?? null;
          listEl
            .querySelectorAll<HTMLButtonElement>('button[data-id]')
            .forEach((node) => node.classList.toggle('active', node === btn));
          if (detailState.selectedId) {
            await loadDetail(detailState.selectedId);
          } else {
            detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord') || 'Kayıt seçin')}</div>`;
          }
        });
      });

      if (detailState.selectedId) {
        await loadDetail(detailState.selectedId);
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
      const response = (await getOU(tenantId, id)) as DetailResponse;
      if (!response.ok || !response.ou) {
        const message = ouErrorMessage(response.errorCode, response.error);
        showError(message);
        detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      renderDetail(response.ou, tenantId);
    } catch (error) {
      console.error(error);
      const message = t('errorGeneric') || 'Error';
      showError(message);
      detailEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
    }
  }

  function renderDetail(ou: OUDetail, tenantId: string) {
    const descendants = buildDescendantSet(ou.id, parentOptions);
    const options = parentOptions.filter((option) => option.id !== ou.id && !descendants.has(option.id));
    detailEl.innerHTML = getDetailTemplate(ou, options);
    const nameInput = requireElement<HTMLInputElement>(detailEl, '#ou-detail-name');
    const parentSelect = requireElement<HTMLSelectElement>(detailEl, '#ou-detail-parent');
    const saveBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const deleteBtn = requireElement<HTMLButtonElement>(detailEl, '[data-action="delete"]');

    saveBtn.addEventListener('click', async () => {
      const payload = {
        name: nameInput.value.trim(),
        parentId: parentSelect.value || null
      };
      if (!requireFields([{ value: payload.name, message: t('legalNameRequired') || 'Ad gerekli' }])) {
        return;
      }
      setBusy(saveBtn, true);
      try {
        const response = (await updateOU(tenantId, ou.id, payload)) as MutationResponse;
        if (!response.ok) {
          showError(ouErrorMessage(response.errorCode, response.error));
          return;
        }
        await loadList(ou.id);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('confirmDelete') || 'Silmek istediğinize emin misiniz?')) return;
      setBusy(deleteBtn, true);
      try {
        const response = (await deleteOU(tenantId, ou.id)) as MutationResponse;
        if (!response.ok) {
          showError(ouErrorMessage(response.errorCode, response.error));
          return;
        }
        detailState.selectedId = null;
        await loadList();
      } finally {
        setBusy(deleteBtn, false);
      }
    });
  }
}

async function collectAllOUs(tenantId: string): Promise<OUOption[]> {
  const aggregated: OUListItem[] = [];
  let page = 0;
  const pageSize = 200;
  let total = Number.POSITIVE_INFINITY;
  while (aggregated.length < total) {
    const response = await listOUs(tenantId, {
      page,
      pageSize,
      sort: 'name',
      order: 'asc'
    });
    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch OUs');
    }
    const items = response.items ?? [];
    aggregated.push(...items);
    total = response.total ?? aggregated.length;
    if (items.length < pageSize) break;
    page += 1;
  }
  const byId = new Map(aggregated.map((item) => [item.id, item]));
  const depthCache = new Map<string, number>();
  const depthOf = (item: OUListItem): number => {
    if (depthCache.has(item.id)) return depthCache.get(item.id)!;
    const parent = item.parentId ? byId.get(item.parentId) : null;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthCache.set(item.id, depth);
    return depth;
  };
  return aggregated.map((item) => ({ ...item, depth: depthOf(item) }));
}

function buildDescendantSet(id: string, items: OUOption[]): Set<string> {
  const byParent = new Map<string | null, OUOption[]>();
  items.forEach((item) => {
    const key = item.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
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

function updateParentSelect(select: HTMLSelectElement, options: OUOption[]) {
  const entries = options
    .slice()
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.name.localeCompare(b.name);
    })
    .map(
      (option) =>
        `<option value="${option.id}">${'— '.repeat(option.depth)}${esc(option.name)}</option>`
    )
    .join('');
  select.innerHTML = `<option value="">${esc(t('none') || '—')}</option>${entries}`;
}

function getShell() {
  const title = t('ou') || 'Organization Units';
  const searchLabel = t('search') || 'Search';
  const reload = t('reload') || 'Reload';
  const createLabel = t('create') || 'Create';
  return `
    <div style="padding:16px;font-family:ui-sans-serif;max-width:720px">
      <h2 style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(title)}</h2>
      <div class="ous-wrap">
        <div class="controls">
          <label class="label">${esc(t('tenantId') || 'Tenant')}</label>
          <input id="ou-tenant" class="input" />
          <label class="label">${esc(searchLabel)}</label>
          <div class="search-row">
            <input id="ou-search" class="input" placeholder="${esc(searchLabel)}" />
            <button class="btn" data-action="refresh">${esc(reload)}</button>
          </div>
          <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#475569">
            <span id="ou-pagination-info">—</span>
            <div style="display:flex;gap:8px">
              <button class="btn" id="ou-page-prev" disabled>${esc(t('tenantPaginationPrev') || 'Önceki')}</button>
              <button class="btn" id="ou-page-next" disabled>${esc(t('tenantPaginationNext') || 'Sonraki')}</button>
            </div>
          </div>
          <div class="create-row">
            <input id="ou-create-name" class="input" placeholder="${esc(t('legalName') || 'Adı')}" />
            <select id="ou-create-parent" class="input"></select>
            <button class="btn primary" data-action="create">${esc(createLabel)}</button>
          </div>
        </div>
        <div class="content">
          <div class="list" data-role="list"></div>
          <div class="detail" data-role="detail"></div>
        </div>
      </div>
    </div>
  `;
}

function getDetailTemplate(ou: OUDetail, options: OUOption[]) {
  const optionMarkup = options
    .slice()
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.name.localeCompare(b.name);
    })
    .map(
      (opt) =>
        `<option value="${opt.id}"${opt.id === ou.parentId ? ' selected' : ''}>${'— '.repeat(
          opt.depth
        )}${esc(opt.name)}</option>`
    )
    .join('');
  const childrenMarkup = (ou.children ?? [])
    .map((child) => `<li>${esc(child.name)}</li>`)
    .join('');
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(ou.name)}</h3>
          <div class="meta">${esc(t('ouId') || 'ID')}: ${esc(ou.id)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save') || 'Kaydet')}</button>
          <button class="btn danger" data-action="delete">${esc(t('delete') || 'Sil')}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('legalName') || 'Adı')}</label>
        <input id="ou-detail-name" class="input" value="${esc(ou.name)}" />
        <label class="label">${esc(t('parent') || 'Parent')}</label>
        <select id="ou-detail-parent" class="input">
          <option value="">${esc(t('none') || '—')}</option>
          ${optionMarkup}
        </select>
      </div>
      <section style="margin-top:16px">
        <h4>${esc(t('children') || 'Alt birimler')}</h4>
        ${
          ou.children && ou.children.length
            ? `<ul class="meta">${childrenMarkup}</ul>`
            : `<div class="empty">${esc(t('noRecords') || 'No records')}</div>`
        }
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
