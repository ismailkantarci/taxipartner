import { t } from "../i18n/index";
import { toastErr } from "../ui/toast";

declare global {
  interface Window {
    __TP_FETCH_GUARD__?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__TP_FETCH_GUARD__) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const response = await originalFetch(input, init);
      if (!response.ok && response.status >= 400) {
        let message = t('errorGeneric') || 'Error';
        try {
          const clone = response.clone();
          const data = await clone.json();
          const derived = data?.error || data?.message;
          if (typeof derived === 'string' && derived.trim()) {
            message = derived;
          }
        } catch {}
        try { toastErr(message); } catch {}
      }
      return response;
    } catch (error) {
      const fallback = error instanceof Error ? error.message : String(error);
      try { toastErr(fallback || t('errorGeneric') || 'Error'); } catch {}
      throw error;
    }
  };
  window.__TP_FETCH_GUARD__ = true;
}

export {};
