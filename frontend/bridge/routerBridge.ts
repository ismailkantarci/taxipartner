let __tp_lastHash = '';

export function goHash(to: string, force = false) {
  const next = String(to ?? '');
  const current = String(window.location.hash ?? '');
  if (!force && current === next) return;
  __tp_lastHash = next;
  window.location.hash = next;
}

export function wireById(id: string, fn: () => void) {
  const el = document.getElementById(id) as HTMLButtonElement | HTMLAnchorElement | null;
  if (el) {
    el.onclick = (event) => {
      event?.preventDefault?.();
      fn();
    };
  }
}

export function probe(map: Record<string, () => void>) {
  Object.entries(map).forEach(([id, fn]) => wireById(id, fn));
}

