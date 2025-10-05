import { inviteAccept } from './api';

function getTokenFromHash() {
  const [, query] = location.hash.split('?');
  const params = new URLSearchParams(query || '');
  return params.get('token') || '';
}

export function mountInviteAccept(root: HTMLElement) {
  const token = getTokenFromHash();
  root.innerHTML = `
    <section style="max-width:360px;margin:40px auto;font-family:system-ui">
      <h2 style="font-size:1.5rem;margin-bottom:12px">Einladung akzeptieren</h2>
      <div><input id="pwd" type="password" placeholder="Neues Passwort" style="padding:8px;width:100%;border:1px solid #cbd5f5;border-radius:6px"></div>
      <div style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px"><input id="totpSetup" type="checkbox"/> TOTP aktivieren</label></div>
      <div style="margin-top:12px"><button id="btn" style="padding:8px 12px;border-radius:6px;background:#0f766e;color:#fff;width:100%">Bestätigen</button></div>
      <div id="qr" style="margin-top:16px"></div>
      <pre id="out" style="margin-top:12px;padding:8px;background:#f8fafc;border-radius:6px;min-height:60px"></pre>
    </section>
  `;
  const get = (selector: string) => root.querySelector(selector) as HTMLElement;
  const output = get('#out') as HTMLPreElement;

  async function accept(payload: Record<string, unknown>) {
    const res = await inviteAccept({ token, ...payload });
    output.textContent = JSON.stringify(res, null, 2);
    return res;
  }

  (get('#btn') as HTMLButtonElement).onclick = async () => {
    const password = (get('#pwd') as HTMLInputElement).value;
    const wantTotp = (get('#totpSetup') as HTMLInputElement).checked;
    const res = await accept({ password, totp: wantTotp ? { setup: true } : undefined });
    if (res.ok && res.qrDataUrl && wantTotp) {
      const qrHost = get('#qr');
      qrHost.innerHTML = `
        <img src="${res.qrDataUrl}" alt="TOTP QR" style="max-width:220px;border:1px solid #cbd5f5;border-radius:6px;padding:8px;background:#fff">
        <div style="margin-top:12px;display:flex;gap:8px">
          <input id="totpCode" placeholder="TOTP Code" style="padding:8px;flex:1;border:1px solid #cbd5f5;border-radius:6px">
          <button id="verify" style="padding:8px 12px;border-radius:6px;background:#1d4ed8;color:#fff">Verify</button>
        </div>
      `;
      (get('#verify') as HTMLButtonElement).onclick = async () => {
        const code = (get('#totpCode') as HTMLInputElement).value;
        await accept({ password, totp: { code } });
      };
    }
  };
}
