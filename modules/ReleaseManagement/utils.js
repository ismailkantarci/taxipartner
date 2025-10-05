// Reusable utilities for Release Management module

export function compareVersion(a, b) {
  const pa = String(a == null ? '' : a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b == null ? '' : b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0, db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function computeReleaseModules(r) {
  if (Array.isArray(r?.modules) && r.modules.length) return [...new Set(r.modules)];
  const out = new Set();
  const arr = Array.isArray(r?._files) ? r._files : [];
  arr.forEach(line => {
    const m = String(line).match(/modules\/([^\/]+)\//);
    if (m) out.add(m[1]);
  });
  return [...out];
}

export function diffHighlight(a, b) {
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const A = String(a || '').split(/(\s+)/); // keep spaces
  const B = String(b || '').split(/(\s+)/);
  const setA = new Set(A.filter(t => !/^\s+$/.test(t)));
  const setB = new Set(B.filter(t => !/^\s+$/.test(t)));
  const ah = A.map(t => {
    if (/^\s+$/.test(t)) return t;
    const safe = esc(t);
    return setB.has(t) ? safe : `<span class="bg-yellow-200 dark:bg-yellow-900">${safe}</span>`;
  }).join('');
  const bh = B.map(t => {
    if (/^\s+$/.test(t)) return t;
    const safe = esc(t);
    return setA.has(t) ? safe : `<span class="bg-yellow-200 dark:bg-yellow-900">${safe}</span>`;
  }).join('');
  return { aHtml: ah, bHtml: bh };
}

export function validateRelease(r) {
  const errs = [];
  if (!r || typeof r !== 'object') { errs.push('invalid'); return errs; }
  if (!r.version) errs.push('version:missing');
  else if (!/^\d+\.\d+\.\d+$/.test(String(r.version))) errs.push('version:semver');
  if (!r.date) errs.push('date:missing');
  else {
    const s = String(r.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      errs.push('date:format');
    } else {
      // Validate calendar date (e.g., month<=12, day<=31 and valid for month)
      const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      if (dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== m || dt.getUTCDate() !== d) {
        errs.push('date:format');
      }
    }
  }
  if (r.status) {
    const s = String(r.status).toLowerCase();
    const allowed = new Set(['stable','beta','alpha','canary']);
    if (!allowed.has(s)) errs.push('status:unknown');
  }
  if (r.description && typeof r.description === 'object') {
    const hasAny = r.description.tr || r.description.de || r.description.en;
    if (!hasAny) errs.push('description:empty');
  }
  return errs;
}

export function bumpPatch(version) {
  const m = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return '0.0.1';
  const major = parseInt(m[1],10)||0;
  const minor = parseInt(m[2],10)||0;
  const patch = parseInt(m[3],10)||0;
  return `${major}.${minor}.${patch+1}`;
}

export function latestVersion(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  arr.sort((a,b) => compareVersion(b?.version, a?.version));
  return arr[0]?.version || '';
}
