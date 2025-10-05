/**
 * Ensures a component mounts once per host element.
 */
export function withMountGuard(host: HTMLElement, key: string, mount: () => void) {
  if (!host) return;
  const attr = 'data-tp-mounted';
  const sig = (host.getAttribute(attr) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (sig.includes(key)) return;
  mount();
  sig.push(key);
  host.setAttribute(attr, sig.join(','));
}

