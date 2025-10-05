export function showModal(contentHtml: string, onOpen?: (overlay: HTMLElement) => void) {
  let overlay = document.getElementById('__tp_modal__') as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '__tp_modal__';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;box-sizing:border-box;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 20px 45px rgba(15,23,42,0.25);min-width:320px;max-width:520px;width:100%;padding:16px;">${contentHtml}</div>`;
  const handle = (event: MouseEvent) => {
    if (event.target === overlay) {
      closeModal();
    }
  };
  overlay.addEventListener('click', handle, { once: true });
  onOpen?.(overlay);
  return overlay;
}

export function closeModal() {
  document.getElementById('__tp_modal__')?.remove();
}
