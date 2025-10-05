import './page.css';
import { listTasks, createTask, updateTask, deleteTask, runTask } from './api';
import { t } from '../i18n/index';
import { toastOk, toastErr } from '../ui/toast';

type TaskItem = {
  id: string;
  name: string;
  description?: string | null;
  cron: string;
  isEnabled: boolean;
  channels?: string | null;
  payload?: string | null;
  lastRunAt?: string | null;
  createdAt?: string;
};

type TasksResponse = {
  ok: boolean;
  items?: TaskItem[];
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  task?: TaskItem;
  error?: string;
};

export async function mountTasksPage(root: HTMLElement) {
  root.innerHTML = '';

  const wrap = el('div', 'wrap');
  const grid = el('div', 'grid');
  const listCard = el('div', 'card');
  const detailCard = el('div', 'card');

  grid.append(listCard, detailCard);
  wrap.append(grid);
  root.append(wrap);

  const toolbar = el('div', 'toolbar');
  toolbar.innerHTML = `
    <div style="font-weight:700">${t('tasks')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="tasks-search" class="input" placeholder="${t('search')}" />
      <button id="tasks-create" class="btn primary">${t('createTask')}</button>
    </div>
  `;

  const listContainer = el('div', 'list');
  listCard.append(toolbar, listContainer);

  const state: {
    items: TaskItem[];
    selectedId: string | null;
    filter: string;
  } = {
    items: [],
    selectedId: null,
    filter: ''
  };

  const searchInput = toolbar.querySelector('#tasks-search') as HTMLInputElement;
  const createButton = toolbar.querySelector('#tasks-create') as HTMLButtonElement;

  searchInput.addEventListener('input', () => {
    state.filter = searchInput.value.trim().toLowerCase();
    renderList();
  });

  createButton.addEventListener('click', async () => {
    try {
      const res: MutationResponse = await createTask({
        name: t('defaultTaskName'),
        description: '',
        cron: '*/5 * * * *',
        channels: { inapp: true },
        payload: { subject: t('defaultSubject'), body: t('defaultBody') },
        isEnabled: true
      });
      if (!res.ok) {
        toastErr(res.error || t('errorGeneric'));
        return;
      }
      await loadTasks(res.task?.id ?? null);
      toastOk(t('toastCreated'));
    } catch (error) {
      toastErr(messageFromError(error));
    }
  });

  await loadTasks(null);

  async function loadTasks(selectId: string | null) {
    try {
      listContainer.innerHTML = `<div class="empty-state">${t('loading')}</div>`;
      const res: TasksResponse = await listTasks();
      if (!res.ok) {
        listContainer.innerHTML = `<div class="empty-state">${res.error || t('tasksLoadFailed')}</div>`;
        toastErr(res.error || t('tasksLoadFailed'));
        return;
      }
      state.items = (res.items ?? []).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      if (!state.items.length) {
        state.selectedId = null;
        renderList();
        renderPlaceholder();
        return;
      }
      state.selectedId = selectId ?? state.items[0].id;
      renderList();
      renderDetail();
    } catch (error) {
      listContainer.innerHTML = `<div class="empty-state">${t('tasksLoadFailed')}</div>`;
      toastErr(messageFromError(error));
    }
  }

  function renderList() {
    listContainer.innerHTML = '';
    const filtered = state.items.filter((item) =>
      item.name.toLowerCase().includes(state.filter)
    );
    if (!filtered.length) {
      listContainer.append(el('div', 'empty-state', t('noTasks')));
      return;
    }
    filtered.forEach((item) => {
      const button = el('button', 'item');
      if (item.id === state.selectedId) button.classList.add('active');
      button.innerHTML = `
        <div style="font-weight:600">${escapeHtml(item.name)}</div>
        <div class="small">${t('cron')}: ${item.cron}</div>
        <div class="small">${item.isEnabled ? t('enabled') : t('disabled')}</div>
      `;
      button.addEventListener('click', () => {
        state.selectedId = item.id;
        renderList();
        renderDetail();
      });
      listContainer.append(button);
    });
  }

  function renderPlaceholder() {
    detailCard.innerHTML = `
      <div class="empty-state">
        ${t('noTaskSelected')}<br />
        <button class="btn primary" id="tasks-create-inline">${t('createTask')}</button>
      </div>
    `;
    const inlineCreate = detailCard.querySelector('#tasks-create-inline') as HTMLButtonElement;
    inlineCreate.addEventListener('click', () => createButton.click());
  }

  function renderDetail() {
    const task = state.items.find((i) => i.id === state.selectedId);
    if (!task) {
      renderPlaceholder();
      return;
    }

    detailCard.innerHTML = '';

    const header = el('div', 'toolbar');
    header.innerHTML = `
      <div style="font-weight:700">${escapeHtml(task.name)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="task-run">${t('runNow')}</button>
        <button class="btn primary" id="task-save">${t('save')}</button>
        <button class="btn danger" id="task-delete">${t('delete')}</button>
      </div>
    `;

    const section = el('div', 'section');
    const channelsFallback = defaultChannels();
    const payloadFallback = defaultPayload();

    section.innerHTML = `
      <label class="small">${t('name')}</label>
      <input id="task-name" class="input" value="${escapeHtml(task.name)}" />

      <label class="small">${t('description')}</label>
      <input id="task-description" class="input" value="${escapeHtml(task.description ?? '')}" />

      <label class="small">${t('cron')}</label>
      <input id="task-cron" class="input" value="${escapeHtml(task.cron)}" />

      <label class="small">${t('channels')}</label>
      <textarea id="task-channels" class="textarea">${escapeHtml(formatJson(task.channels, channelsFallback))}</textarea>

      <label class="small">${t('payload')}</label>
      <textarea id="task-payload" class="textarea">${escapeHtml(formatJson(task.payload, payloadFallback))}</textarea>

      <label class="small">${t('status')}</label>
      <select id="task-enabled" class="input">
        <option value="true" ${task.isEnabled ? 'selected' : ''}>${t('enabled')}</option>
        <option value="false" ${!task.isEnabled ? 'selected' : ''}>${t('disabled')}</option>
      </select>

      <div class="small">${t('lastRun')} ${task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : t('never')}</div>
    `;

    detailCard.append(header, section);

    const nameInput = section.querySelector('#task-name') as HTMLInputElement;
    const descriptionInput = section.querySelector('#task-description') as HTMLInputElement;
    const cronInput = section.querySelector('#task-cron') as HTMLInputElement;
    const channelsInput = section.querySelector('#task-channels') as HTMLTextAreaElement;
    const payloadInput = section.querySelector('#task-payload') as HTMLTextAreaElement;
    const enabledSelect = section.querySelector('#task-enabled') as HTMLSelectElement;

    const runButton = header.querySelector('#task-run') as HTMLButtonElement;
    const saveButton = header.querySelector('#task-save') as HTMLButtonElement;
    const deleteButton = header.querySelector('#task-delete') as HTMLButtonElement;

    runButton.addEventListener('click', async () => {
      try {
        const res = await runTask(task.id);
        if (!res.ok) {
          toastErr(res.error || t('taskRunFailed'));
          return;
        }
        toastOk(t('toastDispatched'));
      } catch (error) {
        toastErr(messageFromError(error));
      }
    });

    saveButton.addEventListener('click', async () => {
      try {
        const channelsJson = parseJson(channelsInput.value, t('channels'));
        if (channelsJson === undefined) return;
        const payloadJson = parseJson(payloadInput.value, t('payload'));
        if (payloadJson === undefined) return;

        const body = {
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          cron: cronInput.value.trim(),
          channels: channelsJson,
          payload: payloadJson,
          isEnabled: enabledSelect.value === 'true'
        };
        const res: MutationResponse = await updateTask(task.id, body);
        if (!res.ok) {
          toastErr(res.error || t('errorGeneric'));
          return;
        }
        await loadTasks(task.id);
        toastOk(t('toastSaved'));
      } catch (error) {
        toastErr(messageFromError(error));
      }
    });

    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(t('confirmDeleteTask'))) return;
      try {
        const res = await deleteTask(task.id);
        if (!res.ok) {
          toastErr(res.error || t('errorGeneric'));
          return;
        }
        await loadTasks(null);
        toastOk(t('toastDeleted'));
      } catch (error) {
        toastErr(messageFromError(error));
      }
    });
  }

  function parseJson(source: string, label: string): unknown | undefined {
    const trimmed = source.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      toastErr(`${label}: ${t('invalidJson')}`);
      return undefined;
    }
  }

  function defaultChannels() {
    return `{
  "inapp": true
}`;
  }

  function defaultPayload() {
    return `{
  "subject": "${t('defaultSubject')}",
  "body": "${t('defaultBody')}"
}`;
  }
}

function el(tag: string, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatJson(source: string | null | undefined, fallback: string) {
  if (!source) return fallback;
  try {
    const parsed = JSON.parse(source);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return source;
  }
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  return t('errorGeneric');
}
