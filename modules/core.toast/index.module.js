const containerId = 'toast-container';

export const Toast = {
  ensureContainer() {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  },
  show(message, type = 'info', timeout = 4000) {
    const el = this.ensureContainer();
    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.className = `toast ${type === 'error' ? 'toast--error' : 'toast--info'}`;
    item.textContent = message;
    el.appendChild(item);
    setTimeout(() => item.remove(), timeout);
  }
};
