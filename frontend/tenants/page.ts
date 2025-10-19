import './page.css';
import {
  listTenants,
  createTenant,
  assignTenantUser,
  getTenantIdentityHistory,
  listCorporateActions,
  createCorporateAction,
  listTenantIdentities,
  createTenantIdentity,
  listShareholdings,
  createShareholding,
  listAttachments,
  createAttachment,
  listOfficers,
  createOfficer,
  listVehicleAssignments,
  createVehicleAssignment,
  listDriverAssignments,
  createDriverAssignment,
  listApprovals,
  createApproval,
} from './api';
import { t } from '../i18n/index';
import { showError, requireFields } from '../ui/error';
import type {
  AttachmentItem,
  CorporateActionItem,
  CreateApprovalInput,
  CreateAttachmentInput,
  CreateDriverAssignmentInput,
  CreateOfficerInput,
  CreateShareholdingInput,
  CreateTenantIdentityInput,
  CreateTenantInput,
  CreateVehicleAssignmentInput,
  DriverAssignmentItem,
  OfficerItem,
  ShareholdingItem,
  TenantApprovalItem,
  TenantIdentityItem,
  TenantItem,
  TenantIdentifierItem,
  VehicleAssignmentItem,
} from './types';
import type { JsonValue } from '../types/json';

const CORPORATE_ACTION_TYPES = ['UMWANDLUNG', 'VERSCHMELZUNG', 'SPALTUNG', 'EINBRINGUNG'] as const;
const CORPORATE_ACTION_LABEL_KEYS: Record<string, string> = {
  UMWANDLUNG: 'corporateActionTypeUmwandlung',
  VERSCHMELZUNG: 'corporateActionTypeVerschmelzung',
  SPALTUNG: 'corporateActionTypeSpaltung',
  EINBRINGUNG: 'corporateActionTypeEinbringung',
};

const TENANT_ID_TYPES = [
  'FN',
  'UID',
  'STEUERNR',
  'GLN',
  'ZVR',
  'GISA',
  'LEGACY',
  'SYNTHETIC',
] as const;

const TENANT_ID_TYPE_LABEL_KEYS: Record<string, string> = {
  FN: 'tenantIdTypeFn',
  UID: 'tenantIdTypeUid',
  STEUERNR: 'tenantIdTypeSteuernr',
  GLN: 'tenantIdTypeGln',
  ZVR: 'tenantIdTypeZvr',
  GISA: 'tenantIdTypeGisa',
  LEGACY: 'tenantIdTypeLegacy',
  SYNTHETIC: 'tenantIdTypeSynthetic',
};

const SHAREHOLDING_ROLE_TYPES = [
  'Komplementär',
  'Kommanditist',
  'Gesellschafter',
  'Anteilseigner',
] as const;

const SHAREHOLDING_ROLE_LABEL_KEYS: Record<string, string> = {
  Komplementär: 'shareholdingRoleKomplementaer',
  Kommanditist: 'shareholdingRoleKommanditist',
  Gesellschafter: 'shareholdingRoleGesellschafter',
  Anteilseigner: 'shareholdingRoleAnteilseigner',
};

const PARTY_TYPE_OPTIONS = ['NatürlichePerson', 'JuristischePerson'] as const;

const PARTY_TYPE_LABEL_KEYS: Record<string, string> = {
  NatürlichePerson: 'partyTypeNaturalPerson',
  JuristischePerson: 'partyTypeLegalEntity',
};

const LIABILITY_OPTIONS = ['beschränkt', 'unbeschränkt'] as const;

const LIABILITY_LABEL_KEYS: Record<string, string> = {
  beschränkt: 'shareholdingLiabilityLimited',
  unbeschränkt: 'shareholdingLiabilityUnlimited',
};

const ATTACHMENT_OWNER_TYPES = ['TENANT', 'COMPANY', 'COMPANY_PERMIT'] as const;

const ATTACHMENT_OWNER_LABEL_KEYS: Record<string, string> = {
  TENANT: 'attachmentOwnerTenant',
  COMPANY: 'attachmentOwnerCompany',
  COMPANY_PERMIT: 'attachmentOwnerPermit',
};

const ATTACHMENT_TYPE_OPTIONS = [
  'FIRMBUCH_AUSZUG',
  'GISA_AUSZUG',
  'RUHEND_BESCHEID',
  'WIEDERBETRIEB_BESCHEID',
  'WKO_ZULASSUNGSBESTAETIGUNG',
] as const;

const ATTACHMENT_TYPE_LABEL_KEYS: Record<string, string> = {
  FIRMBUCH_AUSZUG: 'attachmentTypeFirmenbuch',
  GISA_AUSZUG: 'attachmentTypeGisa',
  RUHEND_BESCHEID: 'attachmentTypeRuhend',
  WIEDERBETRIEB_BESCHEID: 'attachmentTypeWiederbetrieb',
  WKO_ZULASSUNGSBESTAETIGUNG: 'attachmentTypeWko',
};

const TENANT_STATUS_FILTERS: Array<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'tenantFilterStatusAll', fallback: 'All statuses' },
  { value: 'Active', labelKey: 'tenantStatusActive', fallback: 'Active' },
  { value: 'Pending', labelKey: 'tenantStatusPending', fallback: 'Pending' },
  { value: 'Ruhend', labelKey: 'tenantStatusRuhend', fallback: 'Ruhend' },
  { value: 'Suspended', labelKey: 'tenantStatusSuspended', fallback: 'Suspended' },
];

type TenantSortKey = 'created' | 'name' | 'status' | 'tenantid';
type TenantOrder = 'asc' | 'desc';

type TenantListState = {
  query: string;
  status: string;
  page: number;
  pageSize: number;
  total: number;
  sort: TenantSortKey;
  order: TenantOrder;
};

type PageState = {
  selectedTenantId: string | null;
  list: TenantListState;
};

type TenantChangeHandler = (tenantId: string | null, info?: { keepFeedback?: boolean }) => void;

type Services = {
  assignUser(payload: { tenantId: string; userId: string; role?: string }): Promise<void>;
  createTenant(payload: CreateTenantInput): Promise<void>;
  loadTenants(): Promise<void>;
  selectTenant(tenantId: string, options?: { keepFeedback?: boolean }): Promise<void>;
  notifyTenantMutation(): void;
};

type BasicsSectionApi = {
  loadTenants(options?: { keepPage?: boolean }): Promise<void>;
  selectTenant(tenantId: string, options?: { keepFeedback?: boolean }): Promise<void>;
  currentTenantId(): string | null;
};

type SectionContext = {
  state: PageState;
  services: Services;
  requireFields: typeof requireFields;
  showError: typeof showError;
  translate: typeof t;
  onTenantChange(handler: TenantChangeHandler): void;
  offTenantChange(handler: TenantChangeHandler): void;
  emitTenantChange(tenantId: string | null, info?: { keepFeedback?: boolean }): void;
  registerBasicsApi(api: BasicsSectionApi): void;
};

type SectionConfig = {
  id: string;
  titleKey: string;
  hintKey?: string;
  mount: (section: HTMLElement, ctx: SectionContext) => void;
};

export async function mountTenantsPage(root: HTMLElement) {
  const sectionConfigs: SectionConfig[] = [
    { id: 'basics', titleKey: 'tenantsSectionBasicsTitle', hintKey: 'tenantsSectionBasicsHint', mount: mountBasicsSection },
    { id: 'history', titleKey: 'tenantHistoryTitle', mount: mountHistorySection },
    { id: 'identifiers', titleKey: 'tenantIdentifiersTitle', mount: mountIdentifiersSection },
    { id: 'corporate', titleKey: 'corporateActionsTitle', mount: mountCorporateSection },
    { id: 'attachments', titleKey: 'attachmentsTitle', mount: mountAttachmentsSection },
    { id: 'shareholdings', titleKey: 'shareholdingsTitle', mount: mountShareholdingsSection },
    { id: 'officers', titleKey: 'officersTitle', mount: mountOfficersSection },
    { id: 'vehicles', titleKey: 'vehicleAssignmentsTitle', mount: mountVehiclesSection },
    { id: 'drivers', titleKey: 'driverAssignmentsTitle', mount: mountDriversSection },
    { id: 'approvals', titleKey: 'approvalsTitle', mount: mountApprovalsSection },
  ];

  const mounted = await initializeMount(root);
  if (!mounted) {
    return;
  }

  const state: PageState = {
    selectedTenantId: null,
    list: {
      query: '',
      status: 'all',
      page: 0,
      pageSize: 20,
      total: 0,
      sort: 'created',
      order: 'desc',
    },
  };

  const tenantChangeHandlers = new Set<TenantChangeHandler>();
  let basicsApi: BasicsSectionApi | null = null;
  const sectionElements = renderAccordionShell(root, sectionConfigs);
  const emitTenantChange = (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    tenantChangeHandlers.forEach((handler) => {
      try {
        handler(tenantId, info);
      } catch (error) {
        console.error('Tenant change handler failed', error);
      }
    });
  };

  const services: Services = {
    assignUser: async ({ tenantId, userId, role }) => {
      const response = await assignTenantUser(tenantId, { userId, role });
      if (!response.ok) {
        throw new Error(response.error || t('errorGeneric'));
      }
    },
    createTenant: async (payload) => {
      const response = await createTenant(payload);
      if (!response.ok) {
        throw new Error(response.error || t('errorGeneric'));
      }
    },
    loadTenants: async () => {
      if (!basicsApi) {
        return;
      }
      await basicsApi.loadTenants();
    },
    selectTenant: async (tenantId, options) => {
      if (!basicsApi) {
        return;
      }
      await basicsApi.selectTenant(tenantId, options);
    },
    notifyTenantMutation: () => {
      emitTenantChange(state.selectedTenantId, { keepFeedback: true });
    },
  };

  const ctx: SectionContext = {
    state,
    services,
    requireFields,
    showError,
    translate: t,
    onTenantChange: (handler) => tenantChangeHandlers.add(handler),
    offTenantChange: (handler) => tenantChangeHandlers.delete(handler),
    emitTenantChange: (tenantId, info) => emitTenantChange(tenantId, info),
    registerBasicsApi: (api) => {
      basicsApi = api;
    },
  };

  sectionConfigs.forEach((config) => {
    const sectionEl = sectionElements.get(config.id);
    if (!sectionEl) {
      console.warn(`Section element missing: ${config.id}`);
      return;
    }
    config.mount(sectionEl, ctx);
  });
}

async function initializeMount(root: HTMLElement): Promise<boolean> {
  let guardPassed = true;
  try {
    const { withMountGuard } = await import('../ui/mountGuard');
    guardPassed = false;
    withMountGuard(root, 'tenants', () => {
      guardPassed = true;
    });
    if (!guardPassed) return false;
  } catch {
    const attr = (root.getAttribute('data-tp-mounted') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attr.includes('tenants')) return false;
    attr.push('tenants');
    root.setAttribute('data-tp-mounted', attr.join(','));
  }
  return true;
}

function renderAccordionShell(root: HTMLElement, sections: SectionConfig[]): Map<string, HTMLElement> {
  const sectionMarkup = sections
    .map(
      (section, index) => `
        <section class="tenants-section${index === 0 ? ' is-open' : ''}" data-section="${esc(section.id)}">
          <button class="tenants-section__toggle" data-role="toggle" type="button">
            <div>
              <div>${esc(t(section.titleKey) || section.titleKey)}</div>
              ${section.hintKey ? `<div class="tenants-section__hint">${esc(t(section.hintKey) || '')}</div>` : ''}
            </div>
            <span aria-hidden="true">▾</span>
          </button>
          <div class="tenants-section__content" data-role="content"></div>
        </section>
      `
    )
    .join('');

  root.innerHTML = `
    <div class="tenants-page">
      <div class="tenants-layout">
        <div class="tenants-header">
          <h2 class="tenants-title">${esc(t('tenantsTitle'))}</h2>
        </div>
        <div class="tenants-accordion">
          ${sectionMarkup}
        </div>
      </div>
    </div>
  `;

  const map = new Map<string, HTMLElement>();
  root
    .querySelectorAll<HTMLElement>('.tenants-section')
    .forEach((section) => map.set(section.getAttribute('data-section') || '', section));

  root.querySelectorAll<HTMLButtonElement>('.tenants-section__toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const section = toggle.closest('.tenants-section');
      if (!section) return;
      const isOpen = section.classList.contains('is-open');
      if (isOpen) {
        section.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        section.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  return map;
}

function mountBasicsSection(section: HTMLElement, ctx: SectionContext) {
  const { state, services, requireFields, showError, translate } = ctx;
  const listState = state.list;

  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(translate('createTenant'))}</div>
      <form class="tenants-form" data-form="createTenant">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(translate('tenantIdLabel'))}</span> <span class="tp-help">${esc(translate('optional'))}</span></span>
            <input class="tp-input" name="tenantId" data-field="tenantId" autocomplete="off" placeholder="${esc(translate('tenantIdPlaceholder'))}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(translate('legalName') || 'Legal name')}</span>
            <input class="tp-input" name="legalName" data-field="legalName" autocomplete="organization" placeholder="${esc(translate('tenantLegalNamePlaceholder'))}" required />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(translate('tenantLegalFormLabel'))}</span> <span class="tp-help">${esc(translate('optional'))}</span></span>
            <input class="tp-input" name="legalForm" data-field="legalForm" autocomplete="off" placeholder="${esc(translate('tenantLegalFormPlaceholder'))}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(translate('tenantSeatAddressPlaceholder'))}</span> <span class="tp-help">${esc(translate('optional'))}</span></span>
            <input class="tp-input" name="seatAddress" data-field="seatAddress" autocomplete="street-address" placeholder="${esc(translate('tenantSeatAddressPlaceholder'))}" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button type="submit" class="tp-button primary" data-action="submitCreate">${esc(translate('createTenant'))}</button>
          <span class="tp-feedback" data-feedback="createTenant"></span>
        </div>
      </form>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(translate('assignUser'))}</div>
      <form class="tenants-form" data-form="assignUser">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(translate('tenantIdLabel'))}</span>
            <input class="tp-input" name="tenantId" data-field="assignTenantId" autocomplete="off" placeholder="${esc(translate('tenantIdPlaceholder'))}" required />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(translate('userIdLabel') || 'User ID')}</span>
            <input class="tp-input" name="userId" data-field="assignUserId" autocomplete="off" placeholder="${esc(translate('userIdPlaceholder'))}" required />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(translate('roleLabel') || 'Role')}</span> <span class="tp-help">${esc(translate('optional'))}</span></span>
            <input class="tp-input" name="role" data-field="assignRole" autocomplete="off" placeholder="${esc(translate('rolePlaceholder'))}" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button type="submit" class="tp-button" data-action="submitAssign">${esc(translate('assignAction'))}</button>
          <span class="tp-feedback" data-feedback="assignUser"></span>
        </div>
      </form>
    </div>
    <div class="tp-segment" data-block="list">
      <div class="tp-segment__title">${esc(translate('tenantListTitle'))}</div>
      <div class="tp-toolbar">
        <div class="tp-toolbar__search">
          <span class="tp-toolbar__icon">🔍</span>
          <input class="tp-input" data-field="search" type="search" autocomplete="off" placeholder="${esc(translate('tenantSearchPlaceholder') || 'Search tenant...')}" />
        </div>
        <div class="tp-toolbar__filters">
          <select class="tp-select" data-field="status">
            ${TENANT_STATUS_FILTERS.map((option) => `<option value="${esc(option.value)}">${esc(translate(option.labelKey) || option.fallback)}</option>`).join('')}
          </select>
          <select class="tp-select" data-field="sort">
            <option value="created">${esc(translate('tenantSortCreated') || 'Newest')}</option>
            <option value="name">${esc(translate('tenantSortName') || 'Name')}</option>
            <option value="status">${esc(translate('tenantSortStatus') || 'Status')}</option>
            <option value="tenantid">${esc(translate('tenantSortTenantId') || 'Tenant ID')}</option>
          </select>
          <button class="tp-button neutral" type="button" data-action="toggleOrder" aria-live="polite"></button>
          <button class="tp-button" type="button" data-action="refresh">${esc(translate('reload') || 'Reload')}</button>
        </div>
      </div>
      <div class="tp-card-list" data-role="tenantList"></div>
      <div class="tp-pagination">
        <span data-role="paginationInfo">${esc(translate('tenantPaginationIdle') || '')}</span>
        <div class="tp-section-actions">
          <button class="tp-pagination__button" type="button" data-action="prev">${esc(translate('paginationPrev') || 'Prev')}</button>
          <button class="tp-pagination__button" type="button" data-action="next">${esc(translate('paginationNext') || 'Next')}</button>
        </div>
      </div>
    </div>
  `;

  const createForm = content.querySelector<HTMLFormElement>('[data-form="createTenant"]');
  const assignForm = content.querySelector<HTMLFormElement>('[data-form="assignUser"]');
  const tenantListEl = content.querySelector<HTMLDivElement>('[data-role="tenantList"]');
  const paginationInfoEl = content.querySelector<HTMLSpanElement>('[data-role="paginationInfo"]');
  const prevBtn = content.querySelector<HTMLButtonElement>('[data-action="prev"]');
  const nextBtn = content.querySelector<HTMLButtonElement>('[data-action="next"]');
  const refreshBtn = content.querySelector<HTMLButtonElement>('[data-action="refresh"]');
  const orderToggle = content.querySelector<HTMLButtonElement>('[data-action="toggleOrder"]');
  const statusSelect = content.querySelector<HTMLSelectElement>('[data-field="status"]');
  const sortSelect = content.querySelector<HTMLSelectElement>('[data-field="sort"]');
  const searchInput = content.querySelector<HTMLInputElement>('[data-field="search"]');
  const createFeedback = content.querySelector<HTMLSpanElement>('[data-feedback="createTenant"]');
  const assignFeedback = content.querySelector<HTMLSpanElement>('[data-feedback="assignUser"]');

  if (
    !createForm ||
    !assignForm ||
    !tenantListEl ||
    !paginationInfoEl ||
    !prevBtn ||
    !nextBtn ||
    !refreshBtn ||
    !orderToggle ||
    !statusSelect ||
    !sortSelect ||
    !searchInput ||
    !createFeedback ||
    !assignFeedback
  ) {
    console.error('Tenants basics section failed to mount');
    return;
  }

  statusSelect.value = listState.status;
  sortSelect.value = listState.sort;
  searchInput.value = listState.query;

  const ORDER_SYMBOL: Record<TenantOrder, string> = { asc: '↑', desc: '↓' };

  const applyOrderToggleVisual = () => {
    orderToggle.dataset.order = listState.order;
    orderToggle.textContent = ORDER_SYMBOL[listState.order];
    const label =
      listState.order === 'asc'
        ? translate('tenantSortAscending') || 'Ascending'
        : translate('tenantSortDescending') || 'Descending';
    orderToggle.setAttribute('aria-label', label);
    orderToggle.title = label;
  };

  applyOrderToggleVisual();

  let searchDebounce: number | null = null;

  const highlightSelection = (tenantId: string | null) => {
    tenantListEl.querySelectorAll<HTMLElement>('[data-tenant-id]').forEach((item) => {
      if (item.getAttribute('data-tenant-id') === tenantId) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });
  };

  const updatePagination = () => {
    const safeTotal = Math.max(listState.total, 0);
    const totalPages = Math.max(1, Math.ceil(safeTotal / listState.pageSize));
    if (listState.page >= totalPages) {
      listState.page = Math.max(totalPages - 1, 0);
    }
    const currentPage = listState.page;
    const from = safeTotal === 0 ? 0 : currentPage * listState.pageSize + 1;
    const to = safeTotal === 0 ? 0 : Math.min((currentPage + 1) * listState.pageSize, safeTotal);
    if (safeTotal === 0) {
      paginationInfoEl.textContent = translate('noRecords') || 'No records';
    } else {
      const summaryValue = translate('tenantPaginationShowing');
      const summaryPrefix =
        summaryValue && summaryValue !== 'tenantPaginationShowing' ? summaryValue : 'Showing';
      paginationInfoEl.textContent = `${summaryPrefix} ${from}-${to} / ${safeTotal}`;
    }
    prevBtn.disabled = currentPage === 0 || safeTotal === 0;
    nextBtn.disabled = currentPage >= totalPages - 1 || safeTotal === 0;
  };

  const renderList = (items: TenantItem[], activeId: string | null) => {
    if (!items.length) {
      tenantListEl.innerHTML = `<div class="tp-empty">${esc(translate('noRecords') || 'No records')}</div>`;
      highlightSelection(null);
      return;
    }
    tenantListEl.innerHTML = items
      .map((item) => {
        const selected = activeId === item.tenantId;
        const status = item.status ? `<span class="tp-pill tp-pill--status">${esc(item.status)}</span>` : '';
        const primaryId = item.primaryIdentifier
          ? `<span class="tp-meta">${esc(translate('tenantPrimaryIdLabel') || 'Primary ID')}: ${esc(identityTypeLabel(item.primaryIdentifier.idType))} ${esc(item.primaryIdentifier.idValue)}</span>`
          : '';
        const current = item.currentIdentity;
        const validity =
          current?.validFrom
            ? `${formatDate(current.validFrom)} – ${current.validTo ? formatDate(current.validTo) : translate('tenantHistoryOpenEnded')}`
            : '';
        const validityBlock = validity
          ? `<span class="tp-meta">${esc(translate('tenantHistoryValidRange') || 'Valid')}: ${esc(validity)}</span>`
          : '';
        const seatLine = item.seatAddress
          ? `<span class="tp-meta">${esc(item.seatAddress)}</span>`
          : '';
        return `
          <button class="tp-card-list__item${selected ? ' is-active' : ''}" type="button" data-tenant-id="${esc(item.tenantId)}">
            <div class="tp-card-list__title">${esc(item.legalName || item.tenantId)}</div>
            <div class="tp-meta">${esc(translate('tenantIdLabel'))}: ${esc(item.tenantId)}</div>
            ${item.legalForm ? `<div class="tp-meta">${esc(translate('tenantLegalFormLabel'))}: ${esc(item.legalForm)}</div>` : ''}
            ${seatLine}
            <div class="tp-kicker">
              ${status}
              ${validityBlock}
            </div>
            ${primaryId}
          </button>
        `;
      })
      .join('');
    tenantListEl.querySelectorAll<HTMLButtonElement>('[data-tenant-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const tenantId = button.getAttribute('data-tenant-id');
        if (tenantId) {
          void selectTenant(tenantId, { keepFeedback: true });
        }
      });
    });
    highlightSelection(activeId);
  };

  const handleListResponse = async (items: TenantItem[]) => {
    if (!items.length) {
      renderList([], null);
      state.selectedTenantId = null;
      ctx.emitTenantChange(null, { keepFeedback: true });
      return;
    }
    let nextSelection: string | null = state.selectedTenantId;
    if (!nextSelection || !items.some((item) => item.tenantId === nextSelection)) {
      nextSelection = items[0]?.tenantId ?? null;
    }
    renderList(items, nextSelection);
    if (nextSelection) {
      if (nextSelection !== state.selectedTenantId) {
        await selectTenant(nextSelection, { keepFeedback: true });
      } else {
        highlightSelection(nextSelection);
      }
    } else {
      state.selectedTenantId = null;
      ctx.emitTenantChange(null, { keepFeedback: true });
    }
  };

  const loadTenants = async (options?: { keepPage?: boolean }) => {
    if (!options?.keepPage) {
      listState.page = Math.max(listState.page, 0);
    }
    tenantListEl.innerHTML = `<div class="tp-empty">${esc(translate('loading') || 'Loading...')}</div>`;
    paginationInfoEl.textContent = translate('loading') || 'Loading...';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    try {
      const response = await listTenants({
        query: listState.query,
        status: listState.status === 'all' ? undefined : listState.status,
        page: listState.page,
        pageSize: listState.pageSize,
        sort: listState.sort,
        order: listState.order,
      });
      if (!response.ok) {
        const message = response.error || translate('loadFailed');
        showError(message || 'Load failed');
        tenantListEl.innerHTML = `<div class="tp-empty">${esc(message || 'Load failed')}</div>`;
        state.selectedTenantId = null;
        ctx.emitTenantChange(null, { keepFeedback: true });
        return;
      }
      const items = response.items || [];
      listState.sort = (response.sort as TenantSortKey) || listState.sort;
      listState.order = (response.order as TenantOrder) || listState.order;
      listState.page = typeof response.page === 'number' ? response.page : listState.page;
      listState.pageSize =
        typeof response.pageSize === 'number' ? response.pageSize : listState.pageSize;
      listState.total =
        typeof response.total === 'number' ? response.total : items.length;
      statusSelect.value = listState.status;
      sortSelect.value = listState.sort;
      searchInput.value = listState.query;
      applyOrderToggleVisual();
      updatePagination();
      await handleListResponse(items);
    } catch (error) {
      showError(String(error));
      tenantListEl.innerHTML = `<div class="tp-empty">${esc(translate('loadFailed') || 'Load failed')}</div>`;
      state.selectedTenantId = null;
      ctx.emitTenantChange(null, { keepFeedback: true });
    }
  };

  const selectTenant = async (tenantId: string, options?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      state.selectedTenantId = null;
      highlightSelection(null);
      ctx.emitTenantChange(null, options);
      return;
    }
    state.selectedTenantId = tenantId;
    highlightSelection(tenantId);
    ctx.emitTenantChange(tenantId, options);
  };

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(createForm);
    const tenantId = (formData.get('tenantId') as string | null)?.trim() || '';
    const legalName = (formData.get('legalName') as string | null)?.trim() || '';
    const legalForm = (formData.get('legalForm') as string | null)?.trim() || '';
    const seatAddress = (formData.get('seatAddress') as string | null)?.trim() || '';
    createFeedback.textContent = '';
    if (
      !requireFields([
        { value: legalName, message: translate('legalNameRequired') || 'Legal name is required.' },
      ])
    ) {
      return;
    }
    const submitBtn = createForm.querySelector<HTMLButtonElement>('[data-action="submitCreate"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await services.createTenant({
        tenantId: tenantId || undefined,
        legalName,
        legalForm: legalForm || undefined,
        seatAddress: seatAddress || undefined,
      });
      createForm.reset();
      createFeedback.textContent = translate('tenantCreated');
      listState.page = 0;
      await loadTenants();
    } catch (error) {
      showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  assignForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(assignForm);
    const tenantId = (formData.get('tenantId') as string | null)?.trim() || '';
    const userId = (formData.get('userId') as string | null)?.trim() || '';
    const role = (formData.get('role') as string | null)?.trim() || '';
    assignFeedback.textContent = '';
    if (
      !requireFields([
        { value: tenantId, message: translate('tenantIdRequired') || 'Tenant ID required' },
        { value: userId, message: translate('userIdRequired') || 'User ID required' },
      ])
    ) {
      return;
    }
    const submitBtn = assignForm.querySelector<HTMLButtonElement>('[data-action="submitAssign"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await services.assignUser({ tenantId, userId, role: role || undefined });
      assignForm.reset();
      assignFeedback.textContent = translate('tenantAssignSuccess');
    } catch (error) {
      showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  searchInput.addEventListener('input', () => {
    if (searchDebounce) {
      window.clearTimeout(searchDebounce);
    }
    searchDebounce = window.setTimeout(() => {
      listState.query = searchInput.value.trim();
      listState.page = 0;
      void loadTenants();
    }, 250);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      if (searchDebounce) {
        window.clearTimeout(searchDebounce);
      }
      listState.query = searchInput.value.trim();
      listState.page = 0;
      void loadTenants();
    }
  });

  statusSelect.addEventListener('change', () => {
    const nextStatus = statusSelect.value || 'all';
    if (listState.status !== nextStatus) {
      listState.status = nextStatus;
      listState.page = 0;
      void loadTenants();
    }
  });

  sortSelect.addEventListener('change', () => {
    const nextSort = sortSelect.value as TenantSortKey;
    if (listState.sort !== nextSort) {
      listState.sort = nextSort;
      listState.page = 0;
      void loadTenants();
    }
  });

  orderToggle.addEventListener('click', () => {
    listState.order = listState.order === 'asc' ? 'desc' : 'asc';
    applyOrderToggleVisual();
    listState.page = 0;
    void loadTenants();
  });

  prevBtn.addEventListener('click', () => {
    if (listState.page > 0) {
      listState.page -= 1;
      void loadTenants({ keepPage: true });
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(Math.max(listState.total, 0) / listState.pageSize));
    if (listState.page < totalPages - 1) {
      listState.page += 1;
      void loadTenants({ keepPage: true });
    }
  });

  refreshBtn.addEventListener('click', () => {
    void loadTenants({ keepPage: true });
  });

  ctx.registerBasicsApi({
    loadTenants,
    selectTenant,
    currentTenantId: () => state.selectedTenantId,
  });

  void loadTenants();
}

function mountHistorySection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('tenantHistoryTitle') || 'Identity history')}</div>
      <div class="tp-legend">${esc(ctx.translate('tenantHistoryHint') || '')}</div>
      <div class="tp-list" data-role="historyList"></div>
    </div>
  `;

  const historyListEl = content.querySelector<HTMLDivElement>('[data-role="historyList"]');
  if (!historyListEl) return;

  const renderEmpty = (message: string) => {
    historyListEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderHistory = (records: TenantIdentityItem[]) => {
    if (!records.length) {
      renderEmpty(ctx.translate('tenantHistoryEmpty') || 'Keine Historie vorhanden.');
      return;
    }
    historyListEl.innerHTML = records
      .map((record) => {
        const displayName = record.legalName || record.tenantId;
        const validity = `${formatDate(record.validFrom)} – ${record.validTo ? formatDate(record.validTo) : ctx.translate('tenantHistoryOpenEnded')}`;
        const currentFlag = record.currentFlag
          ? `<span class="tp-tag">${esc(ctx.translate('tenantHistoryActive') || 'Aktiv')}</span>`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(displayName)}</span>
              ${currentFlag}
            </header>
            ${record.legalForm ? `<div class="tp-meta"><strong>${esc(ctx.translate('tenantHistoryLegalForm') || 'Legal form')}:</strong> ${esc(record.legalForm)}</div>` : ''}
            ${record.seatAddress ? `<div class="tp-meta"><strong>${esc(ctx.translate('tenantHistorySeat') || 'Seat')}:</strong> ${esc(record.seatAddress)}</div>` : ''}
            <div class="tp-meta"><strong>${esc(ctx.translate('tenantHistoryValidRange') || 'Valid')}:</strong> ${esc(validity)}</div>
          </article>
        `;
      })
      .join('');
  };

  const loadHistory = async (tenantId: string | null) => {
    if (!tenantId) {
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Bitte zuerst einen Mandanten auswählen.');
      return;
    }
    renderEmpty(ctx.translate('tenantHistoryLoading') || 'Lädt …');
    try {
      const response = await getTenantIdentityHistory(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('tenantHistoryLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        return;
      }
      renderHistory(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('tenantHistoryLoadFailed') || 'Load failed');
    }
  };

  ctx.onTenantChange((tenantId) => {
    void loadHistory(tenantId);
  });

  void loadHistory(ctx.state.selectedTenantId);
}

function mountIdentifiersSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('tenantIdentifiersTitle') || 'Identifiers')}</div>
      <div class="tp-legend">${esc(ctx.translate('tenantIdentifiersHint') || '')}</div>
      <div class="tp-list" data-role="identityList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('tenantIdentifiersFormTitle') || 'Add identifier')}</div>
      <form class="tenants-form" data-form="identifiers">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('tenantIdTypeLabel') || 'Type')}</span>
            <select class="tp-select" name="type" data-field="type">
              <option value="">${esc(ctx.translate('tenantIdTypePlaceholder') || 'Select type')}</option>
              ${TENANT_ID_TYPES.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(TENANT_ID_TYPE_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('tenantIdValueLabel') || 'Identifier')}</span>
            <input class="tp-input" name="value" data-field="value" autocomplete="off" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('tenantIdCountryLabel') || 'Country')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="country" data-field="country" maxlength="2" autocomplete="off" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodFrom') || 'Valid from')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validFrom" data-field="validFrom" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodTo') || 'Valid to')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validTo" data-field="validTo" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('tenantIdTargetLabel') || 'Target')}</span>
            <input class="tp-input" name="target" data-field="target" autocomplete="off" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('tenantIdPrimaryLabel') || 'Primary')}</span>
            <div class="tp-inline">
              <input type="checkbox" name="primary" data-field="primary" />
              <span class="tp-help">${esc(ctx.translate('tenantIdPrimaryHint') || '')}</span>
            </div>
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createId">${esc(ctx.translate('tenantIdCreate') || 'Add')}</button>
          <span class="tp-feedback" data-feedback="identifiers"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="identityList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="identifiers"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="identifiers"]');

  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createId"]');
    if (submitBtn) {
      submitBtn.disabled = !enabled;
    }
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderIdentifiers = (items: TenantIdentifierItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('tenantIdsEmpty') || 'No identifiers yet.');
      return;
    }
    listEl.innerHTML = items
      .map((identity) => {
        const validity = identity.validFrom
          ? `${formatDate(identity.validFrom)} – ${identity.validTo ? formatDate(identity.validTo) : ctx.translate('tenantHistoryOpenEnded')}`
          : ctx.translate('tenantHistoryOpenEnded');
        const primaryBadge = identity.primaryFlag
          ? `<span class="tp-tag">${esc(ctx.translate('tenantIdPrimaryBadge') || 'Primary')}</span>`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(identityTypeLabel(identity.idType))}</span>
              ${primaryBadge}
            </header>
            <div class="tp-meta"><strong>${esc(ctx.translate('tenantIdValueLabel') || 'Value')}:</strong> <span class="tp-monospace">${esc(identity.idValue)}</span></div>
            ${identity.countryCode ? `<div class="tp-meta"><strong>${esc(ctx.translate('tenantIdCountryLabel') || 'Country')}:</strong> ${esc(identity.countryCode)}</div>` : ''}
            <div class="tp-meta"><strong>${esc(ctx.translate('tenantIdValidRangeLabel') || 'Valid')}:</strong> ${esc(validity ?? '')}</div>
            ${identity.target ? `<div class="tp-meta"><strong>${esc(ctx.translate('tenantIdTargetLabel') || 'Target')}:</strong> ${esc(identity.target)}</div>` : ''}
          </article>
        `;
      })
      .join('');
  };

  const loadIdentifiers = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listTenantIdentities(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('tenantIdsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderIdentifiers(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('tenantIdsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const type = (formData.get('type') as string | null)?.trim() || '';
    const value = (formData.get('value') as string | null)?.trim() || '';
    const country = (formData.get('country') as string | null)?.trim() || '';
    const validFrom = (formData.get('validFrom') as string | null)?.trim() || '';
    const validTo = (formData.get('validTo') as string | null)?.trim() || '';
    const target = (formData.get('target') as string | null)?.trim() || '';
    const primary = formData.get('primary') === 'on';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: type, message: ctx.translate('tenantIdTypeRequired') || 'Type required' },
        { value: value, message: ctx.translate('tenantIdValueRequired') || 'Value required' },
      ])
    ) {
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createId"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateTenantIdentityInput = {
        idType: type,
        idValue: value,
        countryCode: country || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
        primaryFlag: primary,
        target: target || undefined,
      };
      const response = await createTenantIdentity(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('tenantIdsCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('tenantIdCreated') || 'Identifier added.';
      await loadIdentifiers(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadIdentifiers(tenantId, info);
  });

  void loadIdentifiers(ctx.state.selectedTenantId);
}

function mountCorporateSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('corporateActionsTitle') || 'Corporate actions')}</div>
      <div class="tp-legend">${esc(ctx.translate('corporateActionsHint') || '')}</div>
      <div class="tp-list" data-role="corporateList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('corporateActionsFormTitle') || 'Create action')}</div>
      <form class="tenants-form" data-form="corporate">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('corporateActionTypeLabel') || 'Type')}</span>
            <select class="tp-select" name="actionType" data-field="type">
              <option value="">${esc(ctx.translate('corporateActionTypePlaceholder') || 'Select type')}</option>
              ${CORPORATE_ACTION_TYPES.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(CORPORATE_ACTION_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('corporateActionEffectiveDateLabel') || 'Effective date')}</span>
            <input class="tp-input" type="date" name="effectiveDate" data-field="effectiveDate" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('corporateActionSourceLabel') || 'Source tenants')}</span>
            <input class="tp-input" name="source" data-field="source" autocomplete="off" placeholder="${esc(ctx.translate('corporateActionSourcePlaceholder') || 'tenant-1, tenant-2')}" />
          </label>
        </div>
        <label class="tp-stack">
          <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('corporateActionNoteLabel') || 'Note')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
          <textarea class="tp-textarea" name="note" data-field="note"></textarea>
        </label>
        <div class="tp-stack">
          <span class="tp-meta">${esc(ctx.translate('corporateActionTargetLabel') || 'Target')}: <strong data-role="corporateTarget">-</strong></span>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createCorporate">${esc(ctx.translate('corporateActionCreate') || 'Create')}</button>
          <span class="tp-feedback" data-feedback="corporate"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="corporateList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="corporate"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="corporate"]');
  const targetLabel = content.querySelector<HTMLSpanElement>('[data-role="corporateTarget"]');

  if (!listEl || !form || !feedbackEl || !targetLabel) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean, tenantId: string | null) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createCorporate"]');
    if (submitBtn) submitBtn.disabled = !enabled;
    targetLabel.textContent = tenantId ?? '-';
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId), ctx.state.selectedTenantId);

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderActions = (items: CorporateActionItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('corporateActionsEmpty') || 'No actions recorded.');
      return;
    }
    listEl.innerHTML = items
      .map((action) => {
        const sources = (action.sourceTenantIds || []).join(', ') || '-';
        const note =
          action.note && action.note.trim().length
            ? `<div class="tp-meta">${esc(action.note)}</div>`
            : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(actionTypeLabel(action.actionType))}</span>
              <span class="tp-pill">${esc(formatDate(action.effectiveDate))}</span>
            </header>
            <div class="tp-meta"><strong>${esc(ctx.translate('corporateActionSourceLabel') || 'Source')}:</strong> ${esc(sources)}</div>
            <div class="tp-meta"><strong>${esc(ctx.translate('corporateActionTargetLabel') || 'Target')}:</strong> ${esc(action.targetTenantId)}</div>
            ${note}
          </article>
        `;
      })
      .join('');
  };

  const loadActions = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false, null);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true, tenantId);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listCorporateActions(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('corporateActionsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderActions(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('corporateActionsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const type = (formData.get('actionType') as string | null)?.trim() || '';
    const effectiveDate = (formData.get('effectiveDate') as string | null)?.trim() || '';
    const source = (formData.get('source') as string | null)?.trim() || '';
    const note = (formData.get('note') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    const sourceTenantIds = source
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (
      !ctx.requireFields([
        { value: type, message: ctx.translate('corporateActionTypeRequired') || 'Type required' },
        {
          value: effectiveDate,
          message: ctx.translate('corporateActionEffectiveDateRequired') || 'Effective date required',
        },
        {
          value: sourceTenantIds.length > 0,
          message: ctx.translate('corporateActionSourceRequired') || 'Source tenants required',
        },
      ])
    ) {
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createCorporate"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false, tenantId);
    try {
      const response = await createCorporateAction({
        actionType: type,
        effectiveDate,
        sourceTenantIds,
        targetTenantId: tenantId,
        note: note || undefined,
      });
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('corporateActionCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('corporateActionCreated') || 'Action recorded.';
      await loadActions(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true, tenantId);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadActions(tenantId, info);
  });

  void loadActions(ctx.state.selectedTenantId);
}

function mountAttachmentsSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('attachmentsTitle') || 'Attachments')}</div>
      <div class="tp-legend">${esc(ctx.translate('attachmentsHint') || '')}</div>
      <div class="tp-list" data-role="attachmentList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('attachmentsFormTitle') || 'Add attachment')}</div>
      <form class="tenants-form" data-form="attachments">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('attachmentOwnerLabel') || 'Owner type')}</span>
            <select class="tp-select" name="ownerType" data-field="ownerType">
              ${ATTACHMENT_OWNER_TYPES.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(ATTACHMENT_OWNER_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('attachmentOwnerIdLabel') || 'Owner ID')}</span>
            <input class="tp-input" name="ownerId" data-field="ownerId" autocomplete="off" placeholder="${esc(ctx.translate('attachmentOwnerIdPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('attachmentTypeLabel') || 'Attachment type')}</span>
            <select class="tp-select" name="attachmentType" data-field="type">
              ${ATTACHMENT_TYPE_OPTIONS.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(ATTACHMENT_TYPE_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('attachmentFileRefLabel') || 'File reference')}</span>
            <input class="tp-input" name="fileRef" data-field="fileRef" autocomplete="off" placeholder="${esc(ctx.translate('attachmentFileRefPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('attachmentsIssuedAtLabel') || 'Issued at')}</span>
            <input class="tp-input" type="date" name="issuedAt" data-field="issuedAt" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('attachmentSourceUrlLabel') || 'Source URL')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="sourceUrl" data-field="sourceUrl" autocomplete="off" placeholder="${esc(ctx.translate('attachmentSourceUrlPlaceholder') || '')}" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createAttachment">${esc(ctx.translate('attachmentCreate') || 'Add attachment')}</button>
          <span class="tp-feedback" data-feedback="attachments"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="attachmentList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="attachments"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="attachments"]');
  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createAttachment"]');
    if (submitBtn) submitBtn.disabled = !enabled;
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderAttachments = (items: AttachmentItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('attachmentsEmpty') || 'No attachments.');
      return;
    }
    listEl.innerHTML = items
      .map((attachment) => {
        const ownerLabel =
          ctx.translate(ATTACHMENT_OWNER_LABEL_KEYS[attachment.ownerType] || '') ||
          attachment.ownerType;
        const issuedAt = attachment.issuedAt
          ? formatDate(attachment.issuedAt)
          : ctx.translate('attachmentsIssuedUnknown') || '-';
        const sourceLink =
          attachment.sourceUrl && attachment.sourceUrl.trim().length
            ? `<a href="${esc(attachment.sourceUrl)}" target="_blank" rel="noopener" class="tp-inline">${esc(ctx.translate('attachmentsSourceLink') || attachment.sourceUrl)}</a>`
            : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(attachment.attachmentType)}</span>
              <span class="tp-meta">${esc(ownerLabel)} • ${esc(attachment.ownerId)}</span>
            </header>
            <div class="tp-meta"><strong>${esc(ctx.translate('attachmentFileRefLabel') || 'Reference')}:</strong> <span class="tp-monospace">${esc(attachment.fileRef)}</span></div>
            <div class="tp-meta"><strong>${esc(ctx.translate('attachmentsIssuedAtLabel') || 'Issued at')}:</strong> ${esc(issuedAt)}</div>
            ${sourceLink ? `<div class="tp-meta">${sourceLink}</div>` : ''}
          </article>
        `;
      })
      .join('');
  };

  const loadAttachmentsList = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listAttachments(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('attachmentsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderAttachments(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('attachmentsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const ownerType = (formData.get('ownerType') as string | null)?.trim() || '';
    const ownerId = (formData.get('ownerId') as string | null)?.trim() || '';
    const attachmentType = (formData.get('attachmentType') as string | null)?.trim() || '';
    const fileRef = (formData.get('fileRef') as string | null)?.trim() || '';
    const issuedAt = (formData.get('issuedAt') as string | null)?.trim() || '';
    const sourceUrl = (formData.get('sourceUrl') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: ownerType, message: ctx.translate('attachmentOwnerRequired') || 'Owner required' },
        { value: ownerId, message: ctx.translate('attachmentOwnerIdRequired') || 'Owner ID required' },
        { value: attachmentType, message: ctx.translate('attachmentTypeRequired') || 'Type required' },
        { value: fileRef, message: ctx.translate('attachmentFileRefRequired') || 'File reference required' },
      ])
    ) {
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createAttachment"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateAttachmentInput = {
        ownerType: ownerType as CreateAttachmentInput['ownerType'],
        ownerId,
        attachmentType,
        fileRef,
        issuedAt: issuedAt || undefined,
        sourceUrl: sourceUrl || undefined,
      };
      const response = await createAttachment(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('attachmentCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('attachmentCreated') || 'Attachment added.';
      await loadAttachmentsList(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadAttachmentsList(tenantId, info);
  });

  void loadAttachmentsList(ctx.state.selectedTenantId);
}

function mountShareholdingsSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('shareholdingsTitle') || 'Shareholdings')}</div>
      <div class="tp-legend">${esc(ctx.translate('shareholdingsHint') || '')}</div>
      <div class="tp-list" data-role="shareholdingList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('shareholdingsFormTitle') || 'Add shareholding')}</div>
      <form class="tenants-form" data-form="shareholdings">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingPartyIdLabel') || 'Party ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyId" data-field="partyId" autocomplete="off" placeholder="${esc(ctx.translate('shareholdingPartyIdPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingPartyTypeLabel') || 'Party type')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <select class="tp-select" name="partyType" data-field="partyType">
              ${PARTY_TYPE_OPTIONS.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(PARTY_TYPE_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingPartyNameLabel') || 'Party name')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyName" data-field="partyName" autocomplete="off" placeholder="${esc(ctx.translate('shareholdingPartyNamePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('shareholdingRoleLabel') || 'Role')}</span>
            <select class="tp-select" name="role" data-field="role">
              <option value="">${esc(ctx.translate('shareholdingRolePlaceholder') || 'Select role')}</option>
              ${SHAREHOLDING_ROLE_TYPES.map((role) => `<option value="${esc(role)}">${esc(ctx.translate(SHAREHOLDING_ROLE_LABEL_KEYS[role] || role) || role)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingQuotaLabel') || 'Quota %')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="number" step="0.0001" min="0" max="100" name="quota" data-field="quota" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingEinlageLabel') || 'Capital')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="number" step="0.01" min="0" name="einlage" data-field="einlage" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('shareholdingLiabilityLabel') || 'Liability')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <select class="tp-select" name="liability" data-field="liability">
              <option value="">${esc(ctx.translate('shareholdingLiabilityPlaceholder') || 'Select liability')}</option>
              ${LIABILITY_OPTIONS.map((value) => `<option value="${esc(value)}">${esc(ctx.translate(LIABILITY_LABEL_KEYS[value] || value) || value)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodFrom') || 'Valid from')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validFrom" data-field="validFrom" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodTo') || 'Valid to')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validTo" data-field="validTo" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createShareholding">${esc(ctx.translate('shareholdingCreate') || 'Add shareholding')}</button>
          <span class="tp-feedback" data-feedback="shareholdings"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="shareholdingList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="shareholdings"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="shareholdings"]');
  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createShareholding"]');
    if (submitBtn) submitBtn.disabled = !enabled;
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderShareholdings = (items: ShareholdingItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('shareholdingsEmpty') || 'No shareholdings recorded.');
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const partyName = item.party?.displayName || item.partyId || '-';
        const partyType = item.party ? partyTypeLabel(item.party.type) : '';
        const quota = item.quotaPercent ? `${item.quotaPercent}%` : '';
        const einlage =
          item.einlageAmount !== undefined && item.einlageAmount !== null
            ? `${item.einlageAmount}`
            : '';
        const validity = item.validFrom
          ? `${formatDate(item.validFrom)} – ${item.validTo ? formatDate(item.validTo) : ctx.translate('tenantHistoryOpenEnded')}`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(partyName)}</span>
              ${quota ? `<span class="tp-pill">${esc(quota)}</span>` : ''}
            </header>
            ${partyType ? `<div class="tp-meta">${esc(partyType)}</div>` : ''}
            <div class="tp-meta"><strong>${esc(ctx.translate('shareholdingRoleLabel') || 'Role')}:</strong> ${esc(shareholdingRoleLabel(item.roleType))}</div>
            ${einlage ? `<div class="tp-meta"><strong>${esc(ctx.translate('shareholdingEinlageLabel') || 'Capital')}:</strong> ${esc(einlage)}</div>` : ''}
            ${item.liability ? `<div class="tp-meta"><strong>${esc(ctx.translate('shareholdingLiabilityLabel') || 'Liability')}:</strong> ${esc(liabilityLabel(item.liability))}</div>` : ''}
            ${validity ? `<div class="tp-meta"><strong>${esc(ctx.translate('shareholdingValidRangeLabel') || 'Valid')}:</strong> ${esc(validity)}</div>` : ''}
          </article>
        `;
      })
      .join('');
  };

  const loadShareholdingsList = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listShareholdings(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('shareholdingsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderShareholdings(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('shareholdingsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const partyId = (formData.get('partyId') as string | null)?.trim() || '';
    const partyType = (formData.get('partyType') as string | null)?.trim() || '';
    const partyName = (formData.get('partyName') as string | null)?.trim() || '';
    const roleType = (formData.get('role') as string | null)?.trim() || '';
    const quota = (formData.get('quota') as string | null)?.trim() || '';
    const einlage = (formData.get('einlage') as string | null)?.trim() || '';
    const liability = (formData.get('liability') as string | null)?.trim() || '';
    const validFrom = (formData.get('validFrom') as string | null)?.trim() || '';
    const validTo = (formData.get('validTo') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: roleType, message: ctx.translate('shareholdingRoleRequired') || 'Role required' },
        {
          value: partyId || partyName,
          message: ctx.translate('shareholdingPartyRequired') || 'Party required',
        },
      ])
    ) {
      return;
    }
    if (!partyId && !partyType) {
      ctx.showError(ctx.translate('shareholdingPartyTypeRequired') || 'Party type required');
      return;
    }
    if (!partyId && !partyName) {
      ctx.showError(ctx.translate('shareholdingPartyNameRequired') || 'Party name required');
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createShareholding"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateShareholdingInput = {
        roleType,
        quotaPercent: quota || undefined,
        einlageAmount: einlage || undefined,
        liability: liability || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      };
      if (partyId) {
        payload.partyId = partyId;
      } else {
        payload.party = {
          type: partyType,
          displayName: partyName,
        };
      }
      const response = await createShareholding(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('shareholdingCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('shareholdingCreated') || 'Shareholding added.';
      await loadShareholdingsList(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadShareholdingsList(tenantId, info);
  });

  void loadShareholdingsList(ctx.state.selectedTenantId);
}

function mountOfficersSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('officersTitle') || 'Officers')}</div>
      <div class="tp-legend">${esc(ctx.translate('officersHint') || '')}</div>
      <div class="tp-list" data-role="officerList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('officersFormTitle') || 'Add officer')}</div>
      <form class="tenants-form" data-form="officers">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('officerLevelLabel') || 'Level')}</span>
            <select class="tp-select" name="level" data-field="level">
              <option value="TENANT">${esc(ctx.translate('officerLevelTenant') || 'Tenant')}</option>
              <option value="COMPANY">${esc(ctx.translate('officerLevelCompany') || 'Company')}</option>
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('officerCompanyLabel') || 'Company ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="companyId" data-field="companyId" autocomplete="off" placeholder="${esc(ctx.translate('officerCompanyPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('officerPartyIdLabel') || 'Party ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyId" data-field="partyId" autocomplete="off" placeholder="${esc(ctx.translate('officerPartyIdPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('officerPartyTypeLabel') || 'Party type')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <select class="tp-select" name="partyType" data-field="partyType">
              ${PARTY_TYPE_OPTIONS.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(PARTY_TYPE_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('officerPartyNameLabel') || 'Party name')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyName" data-field="partyName" autocomplete="off" placeholder="${esc(ctx.translate('officerPartyNamePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('officerTypeLabel') || 'Officer type')}</span>
            <input class="tp-input" name="officerType" data-field="officerType" autocomplete="off" placeholder="${esc(ctx.translate('officerTypePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodFrom') || 'Valid from')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validFrom" data-field="validFrom" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('periodTo') || 'Valid to')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="validTo" data-field="validTo" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createOfficer">${esc(ctx.translate('officerCreate') || 'Add officer')}</button>
          <span class="tp-feedback" data-feedback="officers"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="officerList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="officers"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="officers"]');
  const levelSelect = form?.querySelector<HTMLSelectElement>('[data-field="level"]');
  const companyInput = form?.querySelector<HTMLInputElement>('[data-field="companyId"]');
  if (!listEl || !form || !feedbackEl || !levelSelect || !companyInput) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]'));
  let formEnabled = Boolean(ctx.state.selectedTenantId);

  const setFormEnabled = (enabled: boolean) => {
    formEnabled = enabled;
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createOfficer"]');
    if (submitBtn) submitBtn.disabled = !enabled;
    handleLevelChange();
  };

  const handleLevelChange = () => {
    if (!levelSelect || !companyInput) return;
    const isCompany = levelSelect.value === 'COMPANY';
    companyInput.disabled = !formEnabled || !isCompany;
    if (!isCompany) {
      companyInput.value = '';
    }
  };

  levelSelect.addEventListener('change', handleLevelChange);

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderOfficers = (items: OfficerItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('officersEmpty') || 'No officers.');
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const partyName = item.party?.displayName || item.partyId || '-';
        const partyType = item.party ? partyTypeLabel(item.party.type) : '';
        const validity = item.validFrom
          ? `${formatDate(item.validFrom)} – ${item.validTo ? formatDate(item.validTo) : ctx.translate('tenantHistoryOpenEnded')}`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(partyName)}</span>
              <span class="tp-pill">${esc(item.officerType)}</span>
            </header>
            <div class="tp-meta"><strong>${esc(ctx.translate('officerLevelLabel') || 'Level')}:</strong> ${esc(item.level)}</div>
            ${item.companyId ? `<div class="tp-meta"><strong>${esc(ctx.translate('officerCompanyLabel') || 'Company')}:</strong> ${esc(item.companyId)}</div>` : ''}
            ${partyType ? `<div class="tp-meta">${esc(partyType)}</div>` : ''}
            ${validity ? `<div class="tp-meta"><strong>${esc(ctx.translate('officerValidRangeLabel') || 'Valid')}:</strong> ${esc(validity)}</div>` : ''}
          </article>
        `;
      })
      .join('');
  };

  const loadOfficersList = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listOfficers(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('officersLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderOfficers(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('officersLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const level = (formData.get('level') as string | null)?.trim() || 'TENANT';
    const companyId = (formData.get('companyId') as string | null)?.trim() || '';
    const partyId = (formData.get('partyId') as string | null)?.trim() || '';
    const partyType = (formData.get('partyType') as string | null)?.trim() || '';
    const partyName = (formData.get('partyName') as string | null)?.trim() || '';
    const officerType = (formData.get('officerType') as string | null)?.trim() || '';
    const validFrom = (formData.get('validFrom') as string | null)?.trim() || '';
    const validTo = (formData.get('validTo') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (!ctx.requireFields([{ value: officerType, message: ctx.translate('officerTypeRequired') || 'Officer type required' }])) {
      return;
    }
    if (level === 'COMPANY' && !companyId) {
      ctx.showError(ctx.translate('officerCompanyRequired') || 'Company ID required');
      return;
    }
    if (!partyId && !partyName) {
      ctx.showError(ctx.translate('officerPartyRequired') || 'Party required');
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createOfficer"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateOfficerInput = {
        level: level as 'TENANT' | 'COMPANY',
        officerType,
        companyId: level === 'COMPANY' ? companyId || undefined : undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      };
      if (partyId) {
        payload.partyId = partyId;
      } else {
        payload.party = { type: partyType, displayName: partyName };
      }
      const response = await createOfficer(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('officerCreateFailed') || 'Create failed');
      }
      form.reset();
      levelSelect.value = level;
      handleLevelChange();
      feedbackEl.textContent = ctx.translate('officerCreated') || 'Officer added.';
      await loadOfficersList(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadOfficersList(tenantId, info);
  });

  void loadOfficersList(ctx.state.selectedTenantId);
}

function mountVehiclesSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('vehicleAssignmentsTitle') || 'Vehicle assignments')}</div>
      <div class="tp-legend">${esc(ctx.translate('vehicleAssignmentsHint') || '')}</div>
      <div class="tp-list" data-role="vehicleAssignmentList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('vehicleAssignmentsFormTitle') || 'Assign vehicle')}</div>
      <form class="tenants-form" data-form="vehicleAssignments">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('vehicleAssignmentVehicleLabel') || 'Vehicle ID')}</span>
            <input class="tp-input" name="vehicleId" data-field="vehicleId" autocomplete="off" placeholder="${esc(ctx.translate('vehicleAssignmentVehiclePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('vehicleAssignmentCompanyLabel') || 'Company ID')}</span>
            <input class="tp-input" name="companyId" data-field="companyId" autocomplete="off" placeholder="${esc(ctx.translate('vehicleAssignmentCompanyPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('vehicleAssignmentFromLabel') || 'Assigned from')}</span>
            <input class="tp-input" type="date" name="assignedFrom" data-field="assignedFrom" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('vehicleAssignmentToLabel') || 'Assigned to')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="assignedTo" data-field="assignedTo" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('assignmentApprovalLabel') || 'Approval ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="approvalId" data-field="approvalId" autocomplete="off" placeholder="${esc(ctx.translate('vehicleAssignmentApprovalPlaceholder') || '')}" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createVehicleAssignment">${esc(ctx.translate('vehicleAssignmentCreate') || 'Assign vehicle')}</button>
          <span class="tp-feedback" data-feedback="vehicleAssignments"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="vehicleAssignmentList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="vehicleAssignments"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="vehicleAssignments"]');
  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createVehicleAssignment"]');
    if (submitBtn) submitBtn.disabled = !enabled;
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderAssignments = (items: VehicleAssignmentItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('vehicleAssignmentsEmpty') || 'No assignments.');
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const validity = `${formatDate(item.assignedFrom)} – ${item.assignedTo ? formatDate(item.assignedTo) : ctx.translate('tenantHistoryOpenEnded')}`;
        const approval = item.approvalId
          ? `<div class="tp-meta"><strong>${esc(ctx.translate('assignmentApprovalLabel') || 'Approval')}:</strong> ${esc(item.approvalId)}</div>`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(item.vehicleId)}</span>
              <span class="tp-pill">${esc(item.companyId)}</span>
            </header>
            <div class="tp-meta"><strong>${esc(ctx.translate('vehicleAssignmentValidRangeLabel') || 'Valid')}:</strong> ${esc(validity)}</div>
            ${approval}
          </article>
        `;
      })
      .join('');
  };

  const loadAssignments = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listVehicleAssignments(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('vehicleAssignmentsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderAssignments(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('vehicleAssignmentsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const vehicleId = (formData.get('vehicleId') as string | null)?.trim() || '';
    const companyId = (formData.get('companyId') as string | null)?.trim() || '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() || '';
    const assignedTo = (formData.get('assignedTo') as string | null)?.trim() || '';
    const approvalId = (formData.get('approvalId') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: vehicleId, message: ctx.translate('vehicleAssignmentVehicleRequired') || 'Vehicle required' },
        { value: companyId, message: ctx.translate('vehicleAssignmentCompanyRequired') || 'Company required' },
        { value: assignedFrom, message: ctx.translate('vehicleAssignmentFromRequired') || 'Assigned from required' },
      ])
    ) {
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createVehicleAssignment"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateVehicleAssignmentInput = {
        vehicleId,
        companyId,
        assignedFrom,
        assignedTo: assignedTo || undefined,
        approvalId: approvalId || undefined,
      };
      const response = await createVehicleAssignment(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('vehicleAssignmentCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('vehicleAssignmentCreated') || 'Assignment saved.';
      await loadAssignments(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadAssignments(tenantId, info);
  });

  void loadAssignments(ctx.state.selectedTenantId);
}

function mountDriversSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('driverAssignmentsTitle') || 'Driver assignments')}</div>
      <div class="tp-legend">${esc(ctx.translate('driverAssignmentsHint') || '')}</div>
      <div class="tp-list" data-role="driverAssignmentList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('driverAssignmentsFormTitle') || 'Assign driver')}</div>
      <form class="tenants-form" data-form="driverAssignments">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('driverAssignmentPartyIdLabel') || 'Party ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyId" data-field="partyId" autocomplete="off" placeholder="${esc(ctx.translate('driverAssignmentPartyIdPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('driverAssignmentPartyTypeLabel') || 'Party type')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <select class="tp-select" name="partyType" data-field="partyType">
              ${PARTY_TYPE_OPTIONS.map((type) => `<option value="${esc(type)}">${esc(ctx.translate(PARTY_TYPE_LABEL_KEYS[type] || type) || type)}</option>`).join('')}
            </select>
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('driverAssignmentPartyNameLabel') || 'Party name')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="partyName" data-field="partyName" autocomplete="off" placeholder="${esc(ctx.translate('driverAssignmentPartyNamePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('driverAssignmentCompanyLabel') || 'Company ID')}</span>
            <input class="tp-input" name="companyId" data-field="companyId" autocomplete="off" placeholder="${esc(ctx.translate('driverAssignmentCompanyPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('driverAssignmentFromLabel') || 'Assigned from')}</span>
            <input class="tp-input" type="date" name="assignedFrom" data-field="assignedFrom" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('driverAssignmentToLabel') || 'Assigned to')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" type="date" name="assignedTo" data-field="assignedTo" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('assignmentApprovalLabel') || 'Approval ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="approvalId" data-field="approvalId" autocomplete="off" placeholder="${esc(ctx.translate('driverAssignmentApprovalPlaceholder') || '')}" />
          </label>
        </div>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createDriverAssignment">${esc(ctx.translate('driverAssignmentCreate') || 'Assign driver')}</button>
          <span class="tp-feedback" data-feedback="driverAssignments"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="driverAssignmentList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="driverAssignments"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="driverAssignments"]');
  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createDriverAssignment"]');
    if (submitBtn) submitBtn.disabled = !enabled;
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderAssignments = (items: DriverAssignmentItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('driverAssignmentsEmpty') || 'No assignments.');
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const partyName = item.party?.displayName || item.partyId || '-';
        const partyType = item.party ? partyTypeLabel(item.party.type) : '';
        const validity = `${formatDate(item.assignedFrom)} – ${item.assignedTo ? formatDate(item.assignedTo) : ctx.translate('tenantHistoryOpenEnded')}`;
        const approval = item.approvalId
          ? `<div class="tp-meta"><strong>${esc(ctx.translate('assignmentApprovalLabel') || 'Approval')}:</strong> ${esc(item.approvalId)}</div>`
          : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(partyName)}</span>
              <span class="tp-pill">${esc(item.companyId)}</span>
            </header>
            ${partyType ? `<div class="tp-meta">${esc(partyType)}</div>` : ''}
            <div class="tp-meta"><strong>${esc(ctx.translate('driverAssignmentValidRangeLabel') || 'Valid')}:</strong> ${esc(validity)}</div>
            ${approval}
          </article>
        `;
      })
      .join('');
  };

  const loadAssignments = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listDriverAssignments(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('driverAssignmentsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderAssignments(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('driverAssignmentsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const partyId = (formData.get('partyId') as string | null)?.trim() || '';
    const partyType = (formData.get('partyType') as string | null)?.trim() || '';
    const partyName = (formData.get('partyName') as string | null)?.trim() || '';
    const companyId = (formData.get('companyId') as string | null)?.trim() || '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() || '';
    const assignedTo = (formData.get('assignedTo') as string | null)?.trim() || '';
    const approvalId = (formData.get('approvalId') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: companyId, message: ctx.translate('driverAssignmentCompanyRequired') || 'Company required' },
        { value: assignedFrom, message: ctx.translate('driverAssignmentFromRequired') || 'Assigned from required' },
      ])
    ) {
      return;
    }
    if (!partyId && !partyName) {
      ctx.showError(ctx.translate('driverAssignmentPartyRequired') || 'Party required');
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createDriverAssignment"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateDriverAssignmentInput = {
        companyId,
        assignedFrom,
        assignedTo: assignedTo || undefined,
        approvalId: approvalId || undefined,
      };
      if (partyId) {
        payload.partyId = partyId;
      } else {
        payload.party = { type: partyType, displayName: partyName };
      }
      const response = await createDriverAssignment(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('driverAssignmentCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('driverAssignmentCreated') || 'Assignment saved.';
      await loadAssignments(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadAssignments(tenantId, info);
  });

  void loadAssignments(ctx.state.selectedTenantId);
}

function mountApprovalsSection(section: HTMLElement, ctx: SectionContext) {
  const content = section.querySelector<HTMLElement>('.tenants-section__content');
  if (!content) return;

  content.innerHTML = `
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('approvalsTitle') || 'Approvals')}</div>
      <div class="tp-legend">${esc(ctx.translate('approvalsHint') || '')}</div>
      <div class="tp-list" data-role="approvalList"></div>
    </div>
    <div class="tp-segment">
      <div class="tp-segment__title">${esc(ctx.translate('approvalsFormTitle') || 'Request approval')}</div>
      <form class="tenants-form" data-form="approvals">
        <div class="tenants-form__grid">
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('approvalScopeLabel') || 'Scope')}</span>
            <input class="tp-input" name="scope" data-field="scope" autocomplete="off" placeholder="${esc(ctx.translate('approvalScopePlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('approvalObjectLabel') || 'Object ID')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="objectId" data-field="objectId" autocomplete="off" placeholder="${esc(ctx.translate('approvalObjectPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-emphasis">${esc(ctx.translate('approvalOpLabel') || 'Operation')}</span>
            <input class="tp-input" name="op" data-field="op" autocomplete="off" placeholder="${esc(ctx.translate('approvalOpPlaceholder') || '')}" />
          </label>
          <label class="tp-stack">
            <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('approvalIdempotencyLabel') || 'Idempotency key')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
            <input class="tp-input" name="idempotencyKey" data-field="idempotencyKey" autocomplete="off" placeholder="${esc(ctx.translate('approvalIdempotencyPlaceholder') || '')}" />
          </label>
        </div>
        <label class="tp-stack">
          <span class="tp-meta"><span class="tp-emphasis">${esc(ctx.translate('approvalPayloadLabel') || 'Payload')}</span> <span class="tp-help">${esc(ctx.translate('optional'))}</span></span>
          <textarea class="tp-textarea" name="payload" data-field="payload" placeholder="${esc(ctx.translate('approvalPayloadPlaceholder') || '')}"></textarea>
        </label>
        <div class="tp-section-actions">
          <button class="tp-button primary" type="submit" data-action="createApproval">${esc(ctx.translate('approvalCreate') || 'Create approval')}</button>
          <span class="tp-feedback" data-feedback="approvals"></span>
        </div>
      </form>
    </div>
  `;

  const listEl = content.querySelector<HTMLDivElement>('[data-role="approvalList"]');
  const form = content.querySelector<HTMLFormElement>('[data-form="approvals"]');
  const feedbackEl = content.querySelector<HTMLSpanElement>('[data-feedback="approvals"]');
  if (!listEl || !form || !feedbackEl) return;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-field]'));

  const setFormEnabled = (enabled: boolean) => {
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createApproval"]');
    if (submitBtn) submitBtn.disabled = !enabled;
  };

  setFormEnabled(Boolean(ctx.state.selectedTenantId));

  const renderEmpty = (message: string) => {
    listEl.innerHTML = `<div class="tp-empty">${esc(message)}</div>`;
  };

  const renderApprovals = (items: TenantApprovalItem[]) => {
    if (!items.length) {
      renderEmpty(ctx.translate('approvalsEmpty') || 'No approvals.');
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const payload =
          item.payload !== undefined && item.payload !== null
            ? `<pre class="tp-code-block">${esc(JSON.stringify(item.payload, null, 2))}</pre>`
            : '';
        return `
          <article class="tp-list__item">
            <header class="tp-kicker">
              <span class="tp-emphasis">${esc(item.op)}</span>
              <span class="tp-pill">${esc(item.scope)}</span>
            </header>
            ${item.objectId ? `<div class="tp-meta"><strong>${esc(ctx.translate('approvalObjectLabel') || 'Object')}:</strong> ${esc(item.objectId)}</div>` : ''}
            <div class="tp-meta"><strong>${esc(ctx.translate('approvalStatusLabel') || 'Status')}:</strong> ${esc(item.status)}</div>
            <div class="tp-meta"><strong>${esc(ctx.translate('approvalCreatedAtLabel') || 'Created')}:</strong> ${esc(formatDate(item.createdAt))}</div>
            ${item.idempotencyKey ? `<div class="tp-meta"><strong>${esc(ctx.translate('approvalIdempotencyLabel') || 'Idempotency')}:</strong> ${esc(item.idempotencyKey)}</div>` : ''}
            ${payload}
          </article>
        `;
      })
      .join('');
  };

  const loadApprovalsList = async (tenantId: string | null, info?: { keepFeedback?: boolean }) => {
    if (!tenantId) {
      setFormEnabled(false);
      renderEmpty(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      if (!info?.keepFeedback) {
        feedbackEl.textContent = '';
      }
      return;
    }
    setFormEnabled(true);
    renderEmpty(ctx.translate('loading') || 'Loading...');
    try {
      const response = await listApprovals(tenantId);
      if (!response.ok) {
        const message = response.error || ctx.translate('approvalsLoadFailed') || 'Load failed';
        ctx.showError(message);
        renderEmpty(message);
        if (!info?.keepFeedback) {
          feedbackEl.textContent = '';
        }
        return;
      }
      renderApprovals(response.items || []);
    } catch (error) {
      ctx.showError(String(error));
      renderEmpty(ctx.translate('approvalsLoadFailed') || 'Load failed');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = ctx.state.selectedTenantId;
    if (!tenantId) {
      ctx.showError(ctx.translate('tenantSelectRequired') || 'Select tenant first.');
      return;
    }
    const formData = new FormData(form);
    const scope = (formData.get('scope') as string | null)?.trim() || '';
    const objectId = (formData.get('objectId') as string | null)?.trim() || '';
    const op = (formData.get('op') as string | null)?.trim() || '';
    const idempotencyKey = (formData.get('idempotencyKey') as string | null)?.trim() || '';
    const payloadRaw = (formData.get('payload') as string | null)?.trim() || '';
    feedbackEl.textContent = '';

    if (
      !ctx.requireFields([
        { value: scope, message: ctx.translate('approvalScopeRequired') || 'Scope required' },
        { value: op, message: ctx.translate('approvalOpRequired') || 'Operation required' },
      ])
    ) {
      return;
    }

    let parsedPayload: JsonValue | undefined;
    if (payloadRaw) {
      try {
        parsedPayload = JSON.parse(payloadRaw) as JsonValue;
      } catch {
        ctx.showError(ctx.translate('metaJsonInvalid') || 'Invalid JSON');
        return;
      }
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-action="createApproval"]');
    if (submitBtn) submitBtn.disabled = true;
    setFormEnabled(false);
    try {
      const payload: CreateApprovalInput = {
        scope,
        op,
        objectId: objectId || undefined,
        idempotencyKey: idempotencyKey || undefined,
        payload: parsedPayload,
      };
      const response = await createApproval(tenantId, payload);
      if (!response.ok) {
        throw new Error(response.error || ctx.translate('approvalCreateFailed') || 'Create failed');
      }
      form.reset();
      feedbackEl.textContent = ctx.translate('approvalCreated') || 'Approval created.';
      await loadApprovalsList(tenantId, { keepFeedback: true });
    } catch (error) {
      ctx.showError(String(error));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      setFormEnabled(true);
    }
  });

  ctx.onTenantChange((tenantId, info) => {
    void loadApprovalsList(tenantId, info);
  });

  void loadApprovalsList(ctx.state.selectedTenantId);
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

function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString();
}

function identityTypeLabel(type: string): string {
  const key = TENANT_ID_TYPE_LABEL_KEYS[type?.toUpperCase?.() ?? ''] || '';
  return key ? t(key) : type;
}

function actionTypeLabel(type: string): string {
  const key = CORPORATE_ACTION_LABEL_KEYS[type] || '';
  return key ? t(key) : type;
}

function shareholdingRoleLabel(role: string): string {
  const key =
    SHAREHOLDING_ROLE_LABEL_KEYS[role as keyof typeof SHAREHOLDING_ROLE_LABEL_KEYS] || '';
  return key ? t(key) : role;
}

function partyTypeLabel(type: string): string {
  const key = PARTY_TYPE_LABEL_KEYS[type as keyof typeof PARTY_TYPE_LABEL_KEYS] || '';
  return key ? t(key) : type;
}

function liabilityLabel(value: string | null | undefined): string {
  if (!value) return '';
  const key = LIABILITY_LABEL_KEYS[value as keyof typeof LIABILITY_LABEL_KEYS] || '';
  return key ? t(key) : value;
}
