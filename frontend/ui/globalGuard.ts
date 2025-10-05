import { t } from '../i18n/index';

let shownCrash = false;

function showCrash(error: unknown) {
  if (shownCrash) return;
  shownCrash = true;
  console.error('[GlobalGuard] crash:', error);
  try {
    alert(t('errorGeneric') || 'An error occurred');
  } catch {}
  setTimeout(() => {
    shownCrash = false;
  }, 2000);
}

function ensureBanner() {
  let bar = document.getElementById('__tp_offline__') as HTMLDivElement | null;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = '__tp_offline__';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#991b1b;color:#fff;padding:8px 12px;font:14px ui-sans-serif;z-index:9999;display:none;text-align:center';
    const span = document.createElement('span');
    span.id = '__tp_offline_msg__';
    span.textContent = t('offline') || 'Offline';
    bar.appendChild(span);
    document.body.appendChild(bar);
  }
  return bar;
}

function setOfflineBanner(active: boolean) {
  try {
    const banner = ensureBanner();
    banner.style.display = active ? 'block' : 'none';
  } catch {}
}

try {
  window.addEventListener(
    'error',
    (event) => {
      showCrash((event as ErrorEvent)?.error || event.message);
    },
    { capture: true }
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      showCrash((event as PromiseRejectionEvent)?.reason || event);
    },
    { capture: true }
  );

  window.addEventListener('offline', () => setOfflineBanner(true));
  window.addEventListener('online', () => setOfflineBanner(false));

  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    setOfflineBanner(!navigator.onLine);
  }
} catch (error) {
  console.warn('[GlobalGuard] init failed', error);
}

