const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

export function mountSSO(root: HTMLElement) {
  const { code, state, error: queryError } = parseQuery();

  root.innerHTML = '';

  const container = document.createElement('div');
  container.style.maxWidth = '420px';
  container.style.margin = '40px auto';
  container.style.fontFamily = 'ui-sans-serif,system-ui';

  const heading = document.createElement('h2');
  heading.textContent = 'Single Sign-On';
  heading.style.marginBottom = '16px';
  container.append(heading);

  const button = document.createElement('button');
  button.id = 'ssoStart';
  button.textContent = 'SSO ile giriş yap';
  button.style.padding = '10px 16px';
  button.style.borderRadius = '8px';
  button.style.border = 'none';
  button.style.cursor = 'pointer';
  button.style.background = '#111827';
  button.style.color = '#fff';
  button.onclick = () => {
    window.location.href = `${API_BASE}/sso/login?provider=oidc`;
  };
  container.append(button);

  const output = document.createElement('pre');
  output.id = 'ssoOutput';
  output.style.marginTop = '16px';
  output.style.padding = '12px';
  output.style.background = '#f1f5f9';
  output.style.borderRadius = '8px';
  output.style.whiteSpace = 'pre-wrap';
  output.style.fontSize = '13px';
  container.append(output);

  root.append(container);

  if (queryError) {
    output.textContent = queryError;
    return;
  }

  if (code) {
    button.disabled = true;
    output.textContent = 'SSO yanıtı işleniyor…';
    void exchange(code, state ?? undefined);
  }

  async function exchange(authCode: string, stateParam?: string) {
    try {
      const url = new URL(`${API_BASE}/sso/callback`);
      url.searchParams.set('code', authCode);
      if (stateParam) {
        url.searchParams.set('state', stateParam);
      }
      const response = await fetch(url, { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        output.textContent = payload.error ?? 'SSO girişinde hata oluştu.';
        return;
      }
      if (payload.token) {
        localStorage.setItem('token', payload.token);
      }
      output.textContent = 'Giriş başarılı, yönlendiriliyor…';
      history.replaceState(null, '', `${window.location.pathname}`);
      window.location.hash = '#/users';
    } catch (error) {
      output.textContent = error instanceof Error ? error.message : 'SSO girişinde hata oluştu.';
    }
  }
}

function parseQuery(): { code: string | null; state: string | null; error?: string } {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.includes('?') ? url.hash.split('?')[1] : '');

  const code = hashParams.get('code') || searchParams.get('code');
  const state = hashParams.get('state') || searchParams.get('state');
  const error = hashParams.get('error') || searchParams.get('error');

  return { code, state, error: error ?? undefined };
}
