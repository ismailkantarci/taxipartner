import './users.css';
import {
  assignRole,
  createUser,
  getUser,
  getUserPermissions,
  listUsers,
  removeRole,
  revokeSessions
} from './users.api';
import { getRoles } from './roles.api';
import type { RoleItem, UserDetail, UserSummary } from './types';
import { t } from '../i18n/index';

const AUDIT_ROLES = new Set([
  'Kontroller',
  'Wirtschaftsprüfer',
  'Compliance Officer',
  'Internal Auditor'
]);
const PAGE_SIZE = 30;

type Tone = 'info' | 'success' | 'error';

type PermissionsState = {
  loaded: boolean;
  loading: boolean;
  allow: string[];
};

export function mountUsersPage(root: HTMLElement) {
  root.innerHTML = '';

  const page = el('div', 'users-page');

  // LEFT COLUMN
  const leftCol = el('div');

  const listCard = el('div', 'card');
  const listToolbar = el('div', 'toolbar');
  listToolbar.style.gap = '12px';
  const listTitle = el('div', 'small', t('users'));
  const searchWrapper = el('div');
  searchWrapper.style.flex = '1';
  searchWrapper.style.minWidth = '0';
  const searchInput = el('input', 'input') as HTMLInputElement;
  searchInput.placeholder = t('search');
  searchWrapper.append(searchInput);
  listToolbar.append(listTitle, searchWrapper);

  const listContainer = el('div', 'list');

  const pager = el('div', 'toolbar');
  pager.style.justifyContent = 'space-between';
  const pagerInfo = el('div', 'small', '0');
  const pagerButtons = el('div');
  const prevButton = el('button', 'btn', '◀') as HTMLButtonElement;
  prevButton.setAttribute('aria-label', t('prev'));
  const nextButton = el('button', 'btn', '▶') as HTMLButtonElement;
  nextButton.setAttribute('aria-label', t('next'));
  pagerButtons.append(prevButton, nextButton);
  pager.append(pagerInfo, pagerButtons);

  listCard.append(listToolbar, listContainer, pager);

  const createCard = el('div', 'card mt16');
  createCard.innerHTML = `
    <div class="toolbar">
      <div class="small">${t('createUser')}</div>
    </div>
    <div class="section">
      <div class="row">
        <input id="newEmail" class="input" placeholder="${t('emailPlaceholder')}" />
        <button id="btnCreate" class="btn primary">${t('save')}</button>
      </div>
    </div>
  `;

  leftCol.append(listCard, createCard);

  // RIGHT COLUMN
  const rightCard = el('div', 'card');
  const toast = el('div', 'status');
  toast.style.display = 'none';
  const detailContainer = el('div');
  detailContainer.innerHTML = `<div class="section small">${t('selectUser')}</div>`;
  rightCard.append(toast, detailContainer);

  page.append(leftCol, rightCard);
  root.append(page);

  // STATE
  let users: UserSummary[] = [];
  let roles: RoleItem[] = [];
  let currentId: string | null = null;
  let searchQuery = '';
  let skip = 0;
  let total: number | null = null;
  let listNonce = 0;
  let detailNonce = 0;
  let searchTimer: number | null = null;
  let toastTimer: number | null = null;
  let loadingList = false;

  const createButton = createCard.querySelector('#btnCreate') as HTMLButtonElement;
  const createEmailInput = createCard.querySelector('#newEmail') as HTMLInputElement;

  // HELPERS -----------------------------------------------------------
  function showToast(message: string, tone: Tone = 'info', persist = false) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (!message) {
      toast.textContent = '';
      toast.className = 'status';
      toast.style.display = 'none';
      return;
    }
    toast.textContent = message;
    toast.className = `status ${tone}`;
    toast.style.display = 'block';
    if (!persist && tone !== 'error') {
      toastTimer = window.setTimeout(() => {
        showToast('');
      }, tone === 'success' ? 2400 : 2000);
    }
  }

  function updateListHeader() {
    const start = users.length ? skip + 1 : 0;
    const end = users.length ? skip + users.length : 0;
    const range = total !== null
      ? users.length
        ? `${start}–${end} / ${total}`
        : `0 / ${total}`
      : users.length
        ? `${start}–${end}`
        : '0';
    listTitle.textContent = `${t('users')} (${range})`;
  }

  function updatePager() {
    const hasPrev = skip > 0;
    const hasNext = total !== null ? skip + PAGE_SIZE < total : users.length === PAGE_SIZE;
    pagerInfo.textContent = total !== null
      ? users.length
        ? `${skip + 1}–${skip + users.length} / ${total}`
        : `0 / ${total}`
      : users.length
        ? `${skip + 1}–${skip + users.length}`
        : '0';
    prevButton.disabled = !hasPrev || loadingList;
    nextButton.disabled = !hasNext || loadingList;
  }

  function renderList() {
    listContainer.innerHTML = '';
    if (loadingList) {
      listContainer.append(el('div', 'item empty', t('loading')));
      updateListHeader();
      updatePager();
      return;
    }
    if (users.length === 0) {
      listContainer.append(el('div', 'item empty', t('noUsers')));
      updateListHeader();
      updatePager();
      return;
    }

    for (const user of users) {
      const item = el('button', `item${user.id === currentId ? ' active' : ''}`) as HTMLButtonElement;
      const email = user.email ?? t('noEmail');

      const title = el('div');
      title.style.fontWeight = '600';
      title.textContent = email;

      const meta = el('div', 'small', `${t('userId')}: ${user.id}`);

      const rolesWrap = el('div', 'mt8');
      for (const role of user.roles ?? []) {
        const badge = el('span', 'badge', role);
        rolesWrap.append(badge);
      }

      item.append(title, meta, rolesWrap);
      item.onclick = () => {
        void selectUser(user.id);
      };
      listContainer.append(item);
    }

    updateListHeader();
    updatePager();
  }

  async function loadUsers(selectId?: string) {
    const nonce = ++listNonce;
    loadingList = true;
    renderList();
    try {
      const response = await listUsers(searchQuery, skip, PAGE_SIZE);
      if (listNonce !== nonce) {
        return;
      }
      if (response.ok) {
        users = response.users;
        total = typeof response.paging?.total === 'number' ? response.paging.total : null;

        if (users.length === 0 && skip > 0) {
          const newSkip = Math.max(0, total !== null ? Math.min(skip, Math.max(total - PAGE_SIZE, 0)) : skip - PAGE_SIZE);
          if (newSkip !== skip) {
            skip = newSkip;
            await loadUsers(selectId);
            return;
          }
        }

        renderList();

        const hasUsers = users.length > 0;
        if (hasUsers) {
          const preferredId = selectId && users.some((u) => u.id === selectId)
            ? selectId
            : currentId && users.some((u) => u.id === currentId)
            ? currentId
            : users[0].id;
          if (preferredId) {
            await selectUser(preferredId, true);
          }
        } else {
          currentId = null;
          detailContainer.innerHTML = `<div class="section small">${t('noUsers')}</div>`;
        }
      } else {
        users = [];
        renderList();
        showToast(response.error ?? t('errorGeneric'), 'error', true);
      }
    } catch (error) {
      if (listNonce !== nonce) {
        return;
      }
      users = [];
      renderList();
      showToast(getErrorMessage(error), 'error', true);
    } finally {
      loadingList = false;
      updatePager();
    }
  }

  async function selectUser(id: string, force = false) {
    if (!force && currentId === id) {
      return;
    }
    currentId = id;
    renderList();
    const nonce = ++detailNonce;
    detailContainer.innerHTML = `<div class="section small">${t('loading')}</div>`;
    try {
      const response = await getUser(id);
      if (detailNonce !== nonce) {
        return;
      }
      if (response.ok) {
        updateListEntry(response.user);
        renderDetail(response.user);
      } else {
        detailContainer.innerHTML = `<div class="section small">${response.error ?? t('errorGeneric')}</div>`;
      }
    } catch (error) {
      if (detailNonce !== nonce) {
        return;
      }
      detailContainer.innerHTML = `<div class="section small">${getErrorMessage(error)}</div>`;
    }
  }

  function updateListEntry(detail: UserDetail) {
    const index = users.findIndex((user) => user.id === detail.id);
    if (index >= 0) {
      users[index] = {
        ...users[index],
        email: detail.email ?? null,
        roles: [...(detail.roles ?? [])],
        mfaEnabled: Boolean(detail.mfaEnabled),
        sessionsCount: detail.sessions ? detail.sessions.length : users[index].sessionsCount
      };
      renderList();
    }
  }

  function renderDetail(user: UserDetail) {
    detailContainer.innerHTML = '';

    const email = user.email ?? t('noEmail');
    const sessions = user.sessions ?? [];

    const header = el('div', 'section');
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
        <div>
          <div style="font-weight:700;font-size:16px">${escapeHtml(email)}</div>
          <div class="small">${t('userId')}: ${escapeHtml(user.id)}</div>
          <div class="small">${t('mfa')}: ${user.mfaEnabled ? t('mfaEnabled') : t('mfaDisabled')}</div>
          <div class="small">${t('sessions')}: ${sessions.length}</div>
          <div class="mt8" id="roleBadges"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="btnRevoke" class="btn danger">${t('revokeSessions')}</button>
          <button id="btnRefresh" class="btn">${t('refresh')}</button>
        </div>
      </div>
    `;

    detailContainer.append(header);

    const assignSection = el('div', 'section');
    assignSection.innerHTML = `
      <div class="section-title">${t('assignRole')}</div>
      <div class="row">
        <select id="roleSel" class="input">
          <option value="">— ${t('selectRole')} —</option>
          ${roles
            .filter((role) => !(user.roles ?? []).includes(role.name))
            .map((role) => `<option value="${escapeHtml(role.name)}">${escapeHtml(role.name)}</option>`)
            .join('')}
        </select>
        <button id="btnAssign" class="btn primary">${t('save')}</button>
      </div>
      <div id="claimsBox" class="mt12" style="display:none">
        <div class="small" style="margin-bottom:6px">${t('claims')}</div>
        <input id="claimTenants" class="input" placeholder="${t('tenants')}" />
        <div class="row mt8">
          <input id="claimFrom" type="date" class="input" aria-label="${t('periodFrom')}" />
          <input id="claimTo" type="date" class="input" aria-label="${t('periodTo')}" />
        </div>
        <select id="claimPII" class="input mt8">
          <option value="strict">${t('piiStrict')}</option>
          <option value="standard">${t('piiStandard')}</option>
          <option value="none">${t('piiNone')}</option>
        </select>
      </div>
    `;
    detailContainer.append(assignSection);

    const permissionsSection = el('div', 'section');
    const permissionsToolbar = el('div', 'toolbar');
    permissionsToolbar.style.padding = '0 0 8px';
    const permissionsLabel = el('div', 'section-title', t('permissions'));
    permissionsLabel.style.marginBottom = '0';
    const permissionsToggle = el('button', 'btn', t('permissionsShow')) as HTMLButtonElement;
    permissionsToolbar.append(permissionsLabel, permissionsToggle);
    const permissionsBox = el('div', 'perms kv');
    permissionsBox.style.display = 'none';
    permissionsSection.append(permissionsToolbar, permissionsBox);
    detailContainer.append(permissionsSection);

    const claimsSection = el('div', 'section');
    claimsSection.innerHTML = `
      <div class="section-title">${t('claims')}</div>
    `;
    const claimsCode = el('div', 'code');
    claimsCode.textContent = user.claims ? JSON.stringify(user.claims, null, 2) : t('claimsNone');
    claimsSection.append(claimsCode);
    detailContainer.append(claimsSection);

    const sessionsSection = el('div', 'section');
    sessionsSection.innerHTML = `
      <div class="section-title">${t('sessions')}</div>
    `;
    const sessionsCode = el('div', 'code');
    sessionsCode.textContent = sessions.length ? sessions.join('\n') : t('sessionsNone');
    sessionsSection.append(sessionsCode);
    detailContainer.append(sessionsSection);

    renderRoleBadges(user);

    const permissionsState: PermissionsState = {
      loaded: false,
      loading: false,
      allow: []
    };

    const btnRevoke = header.querySelector('#btnRevoke') as HTMLButtonElement;
    const btnRefresh = header.querySelector('#btnRefresh') as HTMLButtonElement;
    const btnAssign = assignSection.querySelector('#btnAssign') as HTMLButtonElement;
    const roleSelect = assignSection.querySelector('#roleSel') as HTMLSelectElement;
    const claimsBox = assignSection.querySelector('#claimsBox') as HTMLDivElement;
    const tenantsInput = assignSection.querySelector('#claimTenants') as HTMLInputElement;
    const fromInput = assignSection.querySelector('#claimFrom') as HTMLInputElement;
    const toInput = assignSection.querySelector('#claimTo') as HTMLInputElement;
    const piiSelect = assignSection.querySelector('#claimPII') as HTMLSelectElement;

    roleSelect.onchange = () => {
      claimsBox.style.display = AUDIT_ROLES.has(roleSelect.value) ? 'block' : 'none';
    };

    btnRevoke.onclick = async () => {
      btnRevoke.disabled = true;
      showToast(t('loading'), 'info', true);
      try {
        const response = await revokeSessions(user.id);
        if (response.ok) {
          showToast(t('successRevoke'), 'success');
          await loadUsers(user.id);
        } else {
          showToast(response.error ?? t('errorGeneric'), 'error', true);
        }
      } catch (error) {
        showToast(getErrorMessage(error), 'error', true);
      } finally {
        btnRevoke.disabled = false;
      }
    };

    btnRefresh.onclick = async () => {
      await selectUser(user.id, true);
    };

    btnAssign.onclick = async () => {
      if (!roleSelect.value) {
        showToast(t('selectRole'), 'error', true);
        return;
      }

      const payload: { role: string; claims?: Record<string, unknown> } = {
        role: roleSelect.value
      };

      if (AUDIT_ROLES.has(roleSelect.value)) {
        const claims: Record<string, unknown> = {};
        const tenants = tenantsInput.value
          .split(',')
          .map((tenant) => tenant.trim())
          .filter(Boolean);
        if (tenants.length > 0) {
          claims.tenants = tenants;
        }
        const from = fromInput.value;
        const to = toInput.value;
        if ((from && !to) || (!from && to)) {
          showToast(t('claimsPeriodInvalid'), 'error', true);
          return;
        }
        if (from && to) {
          claims.period = { from, to };
        }
        claims.piiMask = piiSelect.value;
        payload.claims = claims;
      }

      btnAssign.disabled = true;
      showToast(t('loading'), 'info', true);
      try {
        const response = await assignRole(user.id, payload);
        if (response.ok) {
          roleSelect.value = '';
          claimsBox.style.display = 'none';
          tenantsInput.value = '';
          fromInput.value = '';
          toInput.value = '';
          piiSelect.value = 'strict';
          showToast(t('successAssign'), 'success');
          await loadUsers(user.id);
        } else {
          showToast(response.error ?? t('errorGeneric'), 'error', true);
        }
      } catch (error) {
        showToast(getErrorMessage(error), 'error', true);
      } finally {
        btnAssign.disabled = false;
      }
    };

    permissionsToggle.onclick = async () => {
      if (permissionsBox.style.display === 'none') {
        permissionsBox.style.display = 'block';
        permissionsToggle.textContent = t('permissionsHide');
        if (!permissionsState.loaded && !permissionsState.loading) {
          permissionsState.loading = true;
          permissionsBox.textContent = t('loading');
          try {
            const response = await getUserPermissions(user.id);
            if (response.ok) {
              permissionsState.allow = response.allow;
              permissionsState.loaded = true;
              permissionsBox.innerHTML = response.allow.length
                ? response.allow.map((perm) => `<div>${escapeHtml(perm)}</div>`).join('')
                : `<div class="small">${t('permissionsNone')}</div>`;
            } else {
              permissionsBox.textContent = response.error ?? t('errorGeneric');
            }
          } catch (error) {
            permissionsBox.textContent = getErrorMessage(error);
          } finally {
            permissionsState.loading = false;
          }
        }
      } else {
        permissionsBox.style.display = 'none';
        permissionsToggle.textContent = t('permissionsShow');
      }
    };

    function renderRoleBadges(detailUser: UserDetail) {
      const wrap = header.querySelector('#roleBadges') as HTMLDivElement;
      wrap.innerHTML = '';
      const userRoles = detailUser.roles ?? [];
      if (userRoles.length === 0) {
        wrap.append(el('span', 'small', t('noRoles')));
        return;
      }
      for (const role of userRoles) {
        const badge = el('span', 'badge removable');
        badge.append(document.createTextNode(role));
        const close = el('span', 'x', '×');
        close.setAttribute('title', t('roleRemoveTitle'));
        close.onclick = async (event) => {
          event.stopPropagation();
          const message = t('roleRemoveConfirm').replace('{role}', role);
          if (!window.confirm(message)) {
            return;
          }
          showToast(t('loading'), 'info', true);
          try {
            const response = await removeRole(detailUser.id, role);
            if (response.ok) {
              showToast(t('roleRemoved'), 'success');
              await loadUsers(detailUser.id);
            } else {
              showToast(response.error ?? t('roleRemoveFailed'), 'error', true);
            }
          } catch (error) {
            showToast(getErrorMessage(error), 'error', true);
          }
        };
        badge.append(close);
        wrap.append(badge);
      }
    }
  }

  function scheduleSearch() {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }
    searchTimer = window.setTimeout(() => {
      searchQuery = searchInput.value.trim();
      skip = 0;
      void loadUsers();
    }, 250);
  }

  // EVENT BINDINGS ----------------------------------------------------
  searchInput.addEventListener('input', scheduleSearch);

  prevButton.onclick = async () => {
    if (skip === 0 || loadingList) {
      return;
    }
    skip = Math.max(0, skip - PAGE_SIZE);
    await loadUsers(currentId ?? undefined);
  };

  nextButton.onclick = async () => {
    const hasNext = total !== null ? skip + PAGE_SIZE < total : users.length === PAGE_SIZE;
    if (!hasNext || loadingList) {
      return;
    }
    skip += PAGE_SIZE;
    await loadUsers(currentId ?? undefined);
  };

  createButton.onclick = async () => {
    const email = createEmailInput.value.trim();
    createButton.disabled = true;
    showToast(t('loading'), 'info', true);
    try {
      const response = await createUser(email || undefined);
      if (response.ok) {
        createEmailInput.value = '';
        searchQuery = '';
        searchInput.value = '';
        skip = 0;
        showToast(t('successCreate'), 'success');
        await loadUsers(response.user.id);
      } else {
        showToast(response.error ?? t('errorGeneric'), 'error', true);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error', true);
    } finally {
      createButton.disabled = false;
    }
  };

  // BOOTSTRAP ---------------------------------------------------------
  void (async () => {
    try {
      roles = await getRoles();
    } catch (error) {
      showToast(getErrorMessage(error), 'error', true);
    }
    await loadUsers();
  })();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return t('errorGeneric');
}
