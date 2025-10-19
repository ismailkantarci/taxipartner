import { login } from './api';
import { requireElement } from '../ui/dom';
import { STORAGE_KEY_AUTH_TOKEN, STORAGE_KEY_TP_TOKEN_COOKIE } from '../ui/storageKeys';

export function mountLogin(root: HTMLElement) {
  root.innerHTML = `
    <section style="max-width:320px;margin:40px auto;font-family:system-ui">
      <h2 style="font-size:1.5rem;margin-bottom:12px">Login</h2>
      <div><input id="email" placeholder="email" style="padding:8px;width:100%;border:1px solid #cbd5f5;border-radius:6px"></div>
      <div style="margin-top:8px"><input id="password" placeholder="password" type="password" style="padding:8px;width:100%;border:1px solid #cbd5f5;border-radius:6px"></div>
      <div style="margin-top:12px"><button id="btn" style="padding:8px 12px;border-radius:6px;background:#1d4ed8;color:#fff;width:100%">Login</button></div>
      <pre id="out" style="margin-top:12px;padding:8px;background:#f8fafc;border-radius:6px;min-height:60px"></pre>
    </section>
  `;
  const emailInput = requireElement<HTMLInputElement>(root, '#email');
  const passwordInput = requireElement<HTMLInputElement>(root, '#password');
  const submitBtn = requireElement<HTMLButtonElement>(root, '#btn');
  const output = requireElement<HTMLPreElement>(root, '#out');
  submitBtn.onclick = async () => {
    const res = await login(emailInput.value, passwordInput.value);
    output.textContent = JSON.stringify(res, null, 2);
    if (res.ok && res.token) {
      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, res.token);
      const cookieParts = [
        `${STORAGE_KEY_TP_TOKEN_COOKIE}=${encodeURIComponent(res.token)}`,
        'path=/',
        'SameSite=Lax'
      ];
      if (location.protocol === 'https:') {
        cookieParts.push('Secure');
      }
      if (location.hostname.endsWith('.app.github.dev')) {
        cookieParts.push('domain=.app.github.dev');
      }
      document.cookie = cookieParts.join('; ');
      location.hash = '#/users';
    } else if (res.ok && res.mfa_required) {
      output.textContent = JSON.stringify({ info: 'MFA required', userId: res.userId }, null, 2);
    }
  };
}
