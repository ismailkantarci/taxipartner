const STYLE_ID = 'tp-toast-style';
const CONTAINER_ID = 'tp-toast-container';

type Tone = 'info' | 'success' | 'error';

type ToastFn = (message: string) => void;

type ToastAPI = {
  info: ToastFn;
  ok: ToastFn;
  err: ToastFn;
};

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${CONTAINER_ID} {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
      pointer-events: none;
      font-family: ui-sans-serif, system-ui;
    }
    #${CONTAINER_ID} .tp-toast {
      min-width: 200px;
      max-width: 340px;
      padding: 10px 14px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
      background: #111827;
      color: white;
      font-size: 14px;
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      pointer-events: auto;
    }
    #${CONTAINER_ID} .tp-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    #${CONTAINER_ID} .tp-toast.success { background: #059669; }
    #${CONTAINER_ID} .tp-toast.error { background: #b91c1c; }
  `;
  document.head.append(style);
}

function ensureContainer() {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    document.body.append(el);
  }
  return el;
}

function spawnToast(message: string, tone: Tone = 'info') {
  if (!message) return;
  if (typeof document === 'undefined') {
    console.log(`[toast:${tone}]`, message);
    return;
  }
  ensureStyle();
  const container = ensureContainer();
  const node = document.createElement('div');
  node.className = `tp-toast ${tone === 'info' ? '' : tone}`.trim();
  node.textContent = message;
  container.append(node);
  void node.offsetHeight;
  node.classList.add('show');
  const hide = () => {
    node.classList.remove('show');
    window.setTimeout(() => node.remove(), 220);
  };
  const timeout = tone === 'error' ? 4200 : 2800;
  const timer = window.setTimeout(hide, timeout);
  node.addEventListener('click', () => {
    window.clearTimeout(timer);
    hide();
  });
}

function fallbackAlert(message: string) {
  if (message) window.alert(message);
}

const toastAPI: ToastAPI = {
  info(message: string) {
    if (typeof window === 'undefined') {
      console.log('[toast] info', message);
      return;
    }
    if (document?.body) spawnToast(message, 'info');
    else fallbackAlert(message);
  },
  ok(message: string) {
    if (typeof window === 'undefined') {
      console.log('[toast] success', message);
      return;
    }
    if (document?.body) spawnToast(message, 'success');
    else fallbackAlert(message);
  },
  err(message: string) {
    if (typeof window === 'undefined') {
      console.error('[toast] error', message);
      return;
    }
    if (document?.body) spawnToast(message, 'error');
    else fallbackAlert(message);
  }
};

export const toastInfo = toastAPI.info;
export const toastOk = toastAPI.ok;
export const toastErr = toastAPI.err;
