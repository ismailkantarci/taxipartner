import './page.css';
import { exportCSV, getAudit, listAudit } from './api';

type AuditRow = {
  id: string;
  ts: string;
  actorEmail?: string | null;
  actorId?: string | null;
  tenantId?: string | null;
  action: string;
  method: string;
  path: string;
  status: number;
  userAgent?: string | null;
  ip?: string | null;
  metaJson?: string | null;
  targetType?: string | null;
  targetId?: string | null;
};

type ListResponse = {
  ok: boolean;
  items: AuditRow[];
  paging?: { skip: number; take: number; total: number };
  error?: string;
};

type DetailResponse = {
  ok: boolean;
  item?: AuditRow;
  error?: string;
};

export function mountAuditPage(root: HTMLElement) {
  root.innerHTML = '';

  const wrap = el('div', 'wrap');
  const toolbar = buildToolbar();
  const tableWrap = el('div');
  tableWrap.id = 'auditTable';
  const pagerWrap = buildPager();
  const statusLine = el('div', 'status small', '');
  const detailWrap = el('div', 'panel');
  detailWrap.id = 'auditDetail';

  wrap.append(toolbar, tableWrap, pagerWrap, statusLine, detailWrap);
  root.append(wrap);

  const state = {
    skip: 0,
    take: 50,
    total: 0,
    items: [] as AuditRow[],
    loading: false,
    error: '',
    detailId: parseSelectedId(),
    detail: null as AuditRow | null,
    detailError: '',
    detailLoading: false
  };

  const controls = getControls();
  controls.search.onclick = () => {
    state.skip = 0;
    loadList();
  };
  controls.exportCsv.onclick = () => exportCSV(buildParams());
  controls.prev.onclick = () => {
    if (state.skip === 0) return;
    state.skip = Math.max(0, state.skip - state.take);
    loadList();
  };
  controls.next.onclick = () => {
    if (state.skip + state.take >= state.total) return;
    state.skip += state.take;
    loadList();
  };

  void initialize();

  async function initialize() {
    await loadList();
    if (state.detailId) {
      await loadDetail(state.detailId);
    } else {
      renderDetail();
    }
  }

  function buildToolbar() {
    const bar = el('div', 'toolbar');
    bar.innerHTML = `
      <input id="auditQ" class="input" placeholder="Search action/path/email" />
      <input id="auditActor" class="input" placeholder="actorId" />
      <input id="auditTenant" class="input" placeholder="tenantId" />
      <input id="auditAction" class="input" placeholder="action contains" />
      <select id="auditStatus" class="input">
        <option value="">status</option>
        <option value="200">200</option>
        <option value="201">201</option>
        <option value="400">400</option>
        <option value="401">401</option>
        <option value="403">403</option>
        <option value="404">404</option>
        <option value="500">500</option>
      </select>
      <input id="auditFrom" type="date" class="input" />
      <input id="auditTo" type="date" class="input" />
      <button id="auditSearch" class="btn primary">Ara</button>
      <button id="auditCsv" class="btn">CSV</button>
    `;
    return bar;
  }

  function buildPager() {
    const pager = el('div', 'pager');
    pager.innerHTML = `
      <div class="small" id="auditPagerInfo">0 / 0</div>
      <div>
        <button id="auditPrev" class="btn">◀</button>
        <button id="auditNext" class="btn">▶</button>
      </div>
    `;
    return pager;
  }

  function getControls() {
    return {
      q: document.getElementById('auditQ') as HTMLInputElement,
      actor: document.getElementById('auditActor') as HTMLInputElement,
      tenant: document.getElementById('auditTenant') as HTMLInputElement,
      action: document.getElementById('auditAction') as HTMLInputElement,
      status: document.getElementById('auditStatus') as HTMLSelectElement,
      from: document.getElementById('auditFrom') as HTMLInputElement,
      to: document.getElementById('auditTo') as HTMLInputElement,
      search: document.getElementById('auditSearch') as HTMLButtonElement,
      exportCsv: document.getElementById('auditCsv') as HTMLButtonElement,
      prev: document.getElementById('auditPrev') as HTMLButtonElement,
      next: document.getElementById('auditNext') as HTMLButtonElement,
      pagerInfo: document.getElementById('auditPagerInfo') as HTMLDivElement
    };
  }

  function buildParams() {
    return {
      q: controls.q.value,
      actorId: controls.actor.value,
      tenantId: controls.tenant.value,
      action: controls.action.value,
      status: controls.status.value,
      from: controls.from.value,
      to: controls.to.value,
      skip: state.skip,
      take: state.take
    };
  }

  async function loadList() {
    state.loading = true;
    statusLine.textContent = 'Yükleniyor…';
    const response = (await listAudit(buildParams())) as ListResponse;
    state.loading = false;
    if (!response.ok) {
      state.items = [];
      state.total = 0;
      state.error = response.error ?? 'Listeleme hatası';
      renderTable();
      statusLine.textContent = state.error;
      return;
    }
    state.items = response.items ?? [];
    state.total = response.paging?.total ?? state.items.length;
    state.error = '';
    renderTable();
    statusLine.textContent = `${state.items.length} kayıt yüklendi`;
  }

  async function loadDetail(id: string) {
    if (!id) {
      state.detailId = '';
      state.detail = null;
      state.detailError = '';
      renderDetail();
      return;
    }
    state.detailLoading = true;
    state.detailError = '';
    renderDetail();
    const response = (await getAudit(id)) as DetailResponse;
    state.detailLoading = false;
    if (!response.ok || !response.item) {
      state.detail = null;
      state.detailError = response.error ?? 'Kayıt bulunamadı';
    } else {
      state.detail = response.item;
      state.detailError = '';
    }
    renderDetail();
  }

  function renderTable() {
    const table = el('table', 'table');
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['ts', 'actorEmail', 'tenantId', 'action', 'status', 'id'].forEach((label) => {
      const cell = document.createElement('th');
      cell.textContent = label;
      headerRow.append(cell);
    });
    head.append(headerRow);
    table.append(head);

    const body = document.createElement('tbody');
    if (state.items.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = state.error || 'Kayıt yok';
      row.append(cell);
      body.append(row);
    } else {
      state.items.forEach((row) => {
        const tr = document.createElement('tr');
        tr.append(td(new Date(row.ts).toLocaleString()));
        tr.append(td(row.actorEmail || ''));
        tr.append(td(row.tenantId || ''));
        tr.append(td(row.action));
        tr.append(td(String(row.status)));
        const last = td(row.id);
        last.innerHTML = `<a href="#/audit/${row.id}">${row.id}</a>`;
        tr.append(last);
        tr.onclick = () => {
          if (state.detailId === row.id) return;
          location.hash = `#/audit/${row.id}`;
        };
        body.append(tr);
      });
    }
    table.append(body);
    tableWrap.innerHTML = '';
    tableWrap.append(table);

    controls.pagerInfo.textContent = `${state.total === 0 ? 0 : state.skip + 1}–${Math.min(
      state.skip + state.take,
      state.total
    )} / ${state.total}`;
  }

  function renderDetail() {
    const panel = detailWrap;
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h3');
    title.textContent = state.detailId ? `Audit detail – ${state.detailId}` : 'Audit detail';
    header.append(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    closeBtn.textContent = 'Kapat';
    closeBtn.onclick = () => {
      if (state.detailId) {
        location.hash = '#/audit';
      }
    };
    header.append(closeBtn);
    panel.append(header);

    if (state.detailLoading) {
      panel.append(el('div', 'small', 'Yükleniyor…'));
      return;
    }

    if (state.detailError) {
      panel.append(el('div', 'small', state.detailError));
      return;
    }

    if (!state.detail) {
      panel.append(el('div', 'small', 'Bir kayıt seçin.'));
      return;
    }

    const detail = state.detail;
    const list = document.createElement('dl');
    list.className = 'small';
    const rows: Array<[string, string | undefined | null]> = [
      ['Timestamp', new Date(detail.ts).toLocaleString()],
      ['Actor Email', detail.actorEmail],
      ['Actor ID', detail.actorId],
      ['Tenant', detail.tenantId],
      ['Action', detail.action],
      ['Method', detail.method],
      ['Path', detail.path],
      ['Status', String(detail.status)],
      ['IP', detail.ip],
      ['User Agent', detail.userAgent],
      ['Target Type', detail.targetType],
      ['Target ID', detail.targetId]
    ];
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.style.fontWeight = '600';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.style.margin = '0 0 8px';
      dd.textContent = value || '';
      list.append(dt, dd);
    });
    panel.append(list);

    if (detail.metaJson) {
      const pre = document.createElement('pre');
      try {
        const parsed = JSON.parse(detail.metaJson);
        pre.textContent = JSON.stringify(parsed, null, 2);
      } catch {
        pre.textContent = detail.metaJson;
      }
      panel.append(pre);
    }
  }

  function parseSelectedId() {
    const match = location.hash.match(/^#\/audit(?:\/([^?]+))?/);
    if (!match || !match[1]) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    textContent?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function td(text: string) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  }
}
