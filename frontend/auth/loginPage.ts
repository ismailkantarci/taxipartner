import { login } from './api';

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
  const get = (selector: string) => root.querySelector(selector) as HTMLInputElement | HTMLPreElement | HTMLButtonElement;
  const output = get('#out') as HTMLPreElement;
  (get('#btn') as HTMLButtonElement).onclick = async () => {
    const res = await login(get('#email').value, get('#password').value);
    output.textContent = JSON.stringify(res, null, 2);
    if (res.ok && res.token) {
      localStorage.setItem('token', res.token);
      document.cookie = `tp_token=${encodeURIComponent(res.token)}; path=/; SameSite=Lax`;
      location.hash = '#/users';
    } else if (res.ok && res.mfa_required) {
      output.textContent = JSON.stringify({ info: 'MFA required', userId: res.userId }, null, 2);
    }
  };
}
