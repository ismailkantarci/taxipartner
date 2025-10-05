type Lang = 'de' | 'en' | 'tr';

const SUPPORTED: Lang[] = ['de', 'en', 'tr'];

export function mountLangSwitch(host: HTMLElement | null) {
  if (!host) return;
  host.innerHTML = '';
  const select = document.createElement('select');
  select.className = 'input';
  select.style.minWidth = '90px';
  select.setAttribute('aria-label', 'Language');

  const current = (localStorage.getItem('lang') as Lang | null) || 'de';
  SUPPORTED.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang.toUpperCase();
    if (lang === current) opt.selected = true;
    select.append(opt);
  });

  select.addEventListener('change', () => {
    const value = select.value as Lang;
    localStorage.setItem('lang', value);
    window.location.reload();
  });

  host.append(select);
}

export function currentLang() {
  return (localStorage.getItem('lang') as Lang | null) || 'de';
}
