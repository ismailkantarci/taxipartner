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
  removeCompanyDoc
} from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';

type CompanyListItem = {
  id: string;
  legalName: string;
  legalForm: string;
  status?: string | null;
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

type CompanyDetail = CompanyListItem & {
  uid?: string | null;
  regNo?: string | null;
  officers?: CompanyOfficer[];
  shareholders?: CompanyShareholder[];
  documents?: CompanyDocument[];
};

type ListResponse = {
  ok: boolean;
  items?: CompanyListItem[];
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
};

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
  root.innerHTML = getShell();

  const tenantInput = q<HTMLInputElement>(root, '#companies-tenant');
  const searchInput = q<HTMLInputElement>(root, '#companies-search');
  const nameInput = q<HTMLInputElement>(root, '#companies-create-name');
  const formInput = q<HTMLInputElement>(root, '#companies-create-form');
  const createBtn = q<HTMLButtonElement>(root, '[data-action="create"]');
  const refreshBtn = q<HTMLButtonElement>(root, '[data-action="refresh"]');
  const listEl = q<HTMLDivElement>(root, '[data-role="list"]');
  const detailEl = q<HTMLDivElement>(root, '[data-role="detail"]');

  const state: { selectedId: string | null } = { selectedId: null };
  const stateKey = 'tp_companies_state';
  let lastItems: CompanyListItem[] = [];

  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || 'null') as
      | { tenantId?: string; search?: string }
      | null;
    if (saved?.tenantId && !tenantInput.value) {
      tenantInput.value = saved.tenantId;
    }
    if (saved?.search) {
      searchInput.value = saved.search;
    }
  } catch {}

  const storedTenantId = localStorage.getItem('tp_tenantId');
  if (storedTenantId && !tenantInput.value) {
    tenantInput.value = storedTenantId;
  }

  tenantInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadList();
    }
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadList();
    }
  });

  refreshBtn.addEventListener('click', loadList);

  const csvBtn = root.querySelector('[data-action="csv"]') as HTMLButtonElement | null;
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      if (!lastItems.length) {
        showError(t('noRecords') || 'No records');
        return;
      }
      exportCSV(lastItems, tenantInput.value.trim());
    });
  }

  createBtn.addEventListener('click', async () => {
    const tenantId = tenantInput.value.trim();
    const legalName = nameInput.value.trim();
    const legalForm = formInput.value.trim();
    if (!requireFields([
      { value: tenantId, message: t('tenantIdRequired') },
      { value: legalName, message: t('legalNameRequired') },
      { value: legalForm, message: t('legalFormRequired') }
    ])) {
      return;
    }
    setBusy(createBtn, true);
    try {
      const response = (await createCompany(tenantId, {
        legalName,
        legalForm
      })) as MutationResponse;
      if (!response.ok) {
        showError(response.error || t('companyCreateFailed'));
        return;
      }
      nameInput.value = '';
      formInput.value = '';
      const newId = response.company?.id ?? null;
      await loadList(newId);
    } finally {
      setBusy(createBtn, false);
    }
  });

  loadList().catch((error) => console.error(error));

  async function loadList(selectId?: string | null) {
    const tenantId = tenantInput.value.trim();
    const query = searchInput.value.trim();
    detailEl.innerHTML = '';
    if (!tenantId) {
      const message = t('tenantIdRequired');
      showError(message);
      listEl.innerHTML = `<div class="empty">${esc(t('enterTenantId'))}</div>`;
      lastItems = [];
      return;
    }
    localStorage.setItem('tp_tenantId', tenantId);
    try {
      localStorage.setItem(stateKey, JSON.stringify({ tenantId, search: query }));
    } catch {}
    listEl.innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
    try {
      const response = (await listCompanies(tenantId, query)) as ListResponse;
      if (!response.ok) {
        const message = response.error || t('errorGeneric');
        showError(message);
        listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
        return;
      }
      const items = response.items ?? [];
      lastItems = items;
      if (!items.length) {
        state.selectedId = null;
        listEl.innerHTML = `<div class="empty">${esc(t('noRecords'))}</div>`;
        detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord'))}</div>`;
        return;
      }
      if (selectId) {
        state.selectedId = selectId;
      } else if (!state.selectedId || !items.some((item) => item.id === state.selectedId)) {
        state.selectedId = items[0].id;
      }
      listEl.innerHTML = items
        .map(
          (item) => `
            <button class="list-item ${item.id === state.selectedId ? 'active' : ''}" data-id="${item.id}">
              <div class="title">${esc(item.legalName)}</div>
              <div class="meta">${esc(item.legalForm)}${item.status ? ` • ${esc(item.status)}` : ''}</div>
            </button>
          `
        )
        .join('');

      listEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          state.selectedId = btn.dataset.id ?? null;
          listEl.querySelectorAll('button[data-id]').forEach((node) => node.classList.toggle('active', node === btn));
          if (state.selectedId) {
            await showDetail(state.selectedId);
          } else {
            detailEl.innerHTML = `<div class="empty">${esc(t('selectRecord'))}</div>`;
          }
        });
      });

      if (state.selectedId) {
        await showDetail(state.selectedId);
      }
    } catch (error) {
      console.error(error);
      const message = t('companyListFailed');
      showError(message);
      listEl.innerHTML = `<div class="empty">${esc(message)}</div>`;
      lastItems = [];
    }
  }

  async function showDetail(id: string) {
    const tenantId = tenantInput.value.trim();
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

    const saveBtn = q<HTMLButtonElement>(detailEl, '[data-action="save"]');
    const deleteBtn = q<HTMLButtonElement>(detailEl, '[data-action="delete"]');

    saveBtn.addEventListener('click', async () => {
      const payload = {
        legalName: valueOf<HTMLInputElement>(detailEl, '#companies-detail-name'),
        legalForm: valueOf<HTMLInputElement>(detailEl, '#companies-detail-form'),
        uid: emptyToNull(valueOf<HTMLInputElement>(detailEl, '#companies-detail-uid')),
        regNo: emptyToNull(valueOf<HTMLInputElement>(detailEl, '#companies-detail-regno')),
        status: valueOf<HTMLSelectElement>(detailEl, '#companies-detail-status') || 'Active'
      };
      if (!requireFields([
        { value: payload.legalName, message: t('legalNameRequired') },
        { value: payload.legalForm, message: t('legalFormRequired') }
      ])) {
        return;
      }
      setBusy(saveBtn, true);
      try {
        const response = (await updateCompany(company.id, tenantId, payload)) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyUpdateFailed'));
          return;
        }
        await refreshDetail(company.id, tenantId);
        await loadList(company.id);
      } finally {
        setBusy(saveBtn, false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('companyDeleteConfirm') ?? 'Delete this company?')) return;
      setBusy(deleteBtn, true);
      try {
        const response = (await deleteCompany(company.id, tenantId)) as MutationResponse;
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
    const section = detailEl.querySelector('[data-section="officers"]') as HTMLElement | null;
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeOfficer(company.id, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.id, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = section.querySelector('[data-action="add-officer"]') as HTMLButtonElement | null;
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
        const response = (await addOfficer(company.id, tenantId, {
          type,
          userId,
          validFrom,
          validTo
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.id, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }

  function wireShareholderSection(company: CompanyDetail, tenantId: string) {
    const section = detailEl.querySelector('[data-section="shareholders"]') as HTMLElement | null;
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeShareholder(company.id, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.id, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = section.querySelector('[data-action="add-shareholder"]') as HTMLButtonElement | null;
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
        const response = (await addShareholder(company.id, tenantId, {
          personName,
          roleType,
          percent
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.id, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }

  function wireDocumentSection(company: CompanyDetail, tenantId: string) {
    const section = detailEl.querySelector('[data-section="documents"]') as HTMLElement | null;
    if (!section) return;

    section.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove;
        if (!id) return;
        setBusy(btn, true);
        try {
          const response = (await removeCompanyDoc(company.id, id, tenantId)) as MutationResponse;
          if (!response.ok) {
            showError(response.error || t('companyDeleteFailed'));
            return;
          }
          await refreshDetail(company.id, tenantId);
        } finally {
          setBusy(btn, false);
        }
      });
    });

    const addBtn = section.querySelector('[data-action="add-document"]') as HTMLButtonElement | null;
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
        const response = (await addCompanyDoc(company.id, tenantId, {
          title,
          docType,
          url,
          metaJson
        })) as MutationResponse;
        if (!response.ok) {
          showError(response.error || t('companyCreateFailed'));
          return;
        }
        await refreshDetail(company.id, tenantId);
      } finally {
        setBusy(addBtn, false);
      }
    });
  }
}

function getShell() {
  return `
    <div class="companies-wrap">
      <div class="controls">
        <label class="label">${esc(t('tenantId') ?? 'tenantId')}</label>
        <input id="companies-tenant" class="input" placeholder="${esc(t('tenantId') ?? 'tenantId')}" />
        <label class="label">${esc(t('search') ?? 'Search')}</label>
        <div class="search-row">
          <input id="companies-search" class="input" placeholder="${esc(t('search') ?? 'Search')}" />
          <button class="btn" data-action="refresh">${esc(t('reload') ?? 'Reload')}</button>
          <button class="btn" data-action="csv">${esc(t('export') ?? 'Export')}</button>
        </div>
        <div class="create-row">
          <input id="companies-create-name" class="input" placeholder="${esc(t('legalName') ?? 'Legal name')}" />
          <input id="companies-create-form" class="input" placeholder="${esc(t('legalForm') ?? 'Legal form')}" />
          <button class="btn primary" data-action="create">${esc(t('create') ?? 'Create')}</button>
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
  const statuses = [
    { value: 'Active', label: t('statusActive') || 'Active' },
    { value: 'Passive', label: t('statusPassive') || 'Passive' }
  ];
  return `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h3>${esc(company.legalName)}</h3>
          <div class="meta">${esc(company.legalForm)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="save">${esc(t('save'))}</button>
          <button class="btn danger" data-action="delete">${esc(t('delete'))}</button>
        </div>
      </div>
      <div class="detail-grid">
        <label class="label">${esc(t('legalName') || 'Legal name')}</label>
        <input id="companies-detail-name" class="input" value="${esc(company.legalName)}" />
        <label class="label">${esc(t('legalForm') || 'Legal form')}</label>
        <input id="companies-detail-form" class="input" value="${esc(company.legalForm)}" />
        <label class="label">${esc(t('uid') || 'UID')}</label>
        <input id="companies-detail-uid" class="input" value="${esc(company.uid ?? '')}" />
        <label class="label">${esc(t('regNo') || 'Registration no.')}</label>
        <input id="companies-detail-regno" class="input" value="${esc(company.regNo ?? '')}" />
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
    </div>
  `;
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

function q<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector(selector);
  if (!el) {
    throw new Error(`Selector not found: ${selector}`);
  }
  return el as T;
}

function valueOf<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(root: ParentNode, selector: string): string {
  const el = root.querySelector(selector) as T | null;
  return el ? el.value.trim() : '';
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
    const headers = ['id', 'legalName', 'legalForm', 'status'];
    const rows = [headers].concat(
      items.map((item) => [item.id, item.legalName, item.legalForm, item.status ?? ''])
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
