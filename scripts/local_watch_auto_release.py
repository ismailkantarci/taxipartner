#!/usr/bin/env python3
"""
Local auto-release watcher (no Git, no Node required)
Scans the workspace for file changes at an interval and automatically:
 - bumps patch version in package.json + system.meta.json + module manifests
 - prepends a new multi-language entry into modules/ReleaseManagement/release-log.json
 - records a simple state snapshot to avoid re-triggering on its own writes

Run:  python3 scripts/local_watch_auto_release.py --interval 5
Stop: Ctrl+C

Notes:
 - Ignores common build/output/config folders to reduce noise.
 - Description lists up to 50 changed files. You can edit the entry later if needed.
"""
import argparse, json, os, sys, time, hashlib, datetime, fnmatch
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / 'package.json'
META = ROOT / 'system.meta.json'
REL = ROOT / 'modules' / 'ReleaseManagement' / 'release-log.json'
STATE = ROOT / '.local_release_state.json'

IGNORE_DIRS = {'.git', '.githooks', 'node_modules', 'dist', 'release-pack', 'metrics', '.github', '.vscode', '.idea', '__pycache__'}
IGNORE_GLOBS = ['*.log', '*.tmp', '*.swp', '.DS_Store']

def should_skip(p: Path) -> bool:
    for part in p.parts:
        if part in IGNORE_DIRS:
            return True
    for pat in IGNORE_GLOBS:
        if fnmatch.fnmatch(p.name, pat):
            return True
    # avoid self-trigger loops
    if str(p).endswith('release-log.json'):
        return True
    if p.name in {'package.json', 'system.meta.json'}:
        return True
    if p.name == 'module.manifest.json':
        return True
    if p.name == '.local_release_state.json':
        return True
    return False

def snapshot() -> dict:
    snap = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        d = Path(dirpath)
        # prune ignore dirs in-place for performance
        dirnames[:] = [n for n in dirnames if n not in IGNORE_DIRS]
        for name in filenames:
            p = d / name
            if should_skip(p):
                continue
            try:
                st = p.stat()
            except Exception:
                continue
            snap[str(p.relative_to(ROOT))] = int(st.st_mtime)
    return snap

def diff(prev: dict, curr: dict):
    added = [k for k in curr.keys() if k not in prev]
    removed = [k for k in prev.keys() if k not in curr]
    modified = [k for k in curr.keys() if k in prev and curr[k] != prev[k]]
    return added, modified, removed

def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return fallback

def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def bump_patch(v: str) -> str:
    parts = [int(x) if x.isdigit() else 0 for x in str(v or '0.0.0').split('.')]
    while len(parts) < 3:
        parts.append(0)
    parts[2] += 1
    return '.'.join(map(str, parts))

def in_freeze() -> bool:
    cal = ROOT / 'release-calendar.yml'
    if not cal.exists():
        return False
    try:
        txt = cal.read_text(encoding='utf-8')
        starts = re.findall(r'^\s*start:\s*"?([0-9T:.-]+Z)"?', txt, flags=re.MULTILINE)
        ends = re.findall(r'^\s*end:\s*"?([0-9T:.-]+Z)"?', txt, flags=re.MULTILINE)
        pairs = list(zip(starts, ends))
        now = datetime.datetime.utcnow().replace(tzinfo=None)
        for s,e in pairs:
            try:
                sdt = datetime.datetime.fromisoformat(s.replace('Z',''))
                edt = datetime.datetime.fromisoformat(e.replace('Z',''))
                if sdt <= now <= edt:
                    return True
            except Exception:
                continue
    except Exception:
        return False
    return False

def _filter_changes(changes):
    def filt(arr):
        out = []
        for x in arr:
            if x.endswith('.local_release_state.json'): continue
            if x.endswith('release-log.json'): continue
            if x.endswith('package.json'): continue
            if x.endswith('system.meta.json'): continue
            if x.endswith('module.manifest.json'): continue
            out.append(x)
        return out
    return {
        'added': filt(changes.get('added', [])),
        'modified': filt(changes.get('modified', [])),
        'removed': filt(changes.get('removed', []))
    }

def apply_release(changes):
    changes = _filter_changes(changes)
    if os.environ.get('RELEASE_EXCEPTION','').lower() not in ('1','true','yes'):
        if in_freeze():
            print('[local-watch] in freeze window, skipping release bump (set RELEASE_EXCEPTION=true to override)')
            return
    pkg = load_json(PKG, {}) or {}
    rel = load_json(REL, []) or []
    meta = load_json(META, {}) or {}
    prev = pkg.get('version') or (rel and rel[0].get('version')) or '0.0.0'
    nextv = bump_patch(prev)

    files_list = []
    for k in ('added','modified','removed'):
        files_list += [f"{k}: {x}" for x in changes.get(k, [])]

    # Build friendly, multi-language description instead of raw file list
    def classify(path: str) -> str:
        p = path
        if p.startswith('modules/core.footer') or 'core.footer' in p:
            return 'ui_footer'
        if p.startswith('modules/core.header') or 'core.header' in p:
            return 'ui_header'
        if p.startswith('modules/core.sidebar') or 'core.sidebar' in p:
            return 'ui_sidebar'
        if p.startswith('modules/ReleaseManagement'):
            return 'release_mgmt'
        if p.startswith('modules/core.state'):
            return 'state'
        if p.startswith('modules/core.moduleLoader'):
            return 'loader'
        if p.startswith('locales/'):
            return 'i18n'
        if p.startswith('scripts/'):
            return 'automation'
        if p.startswith('src/styles/') or p == 'tailwind.config.js':
            return 'styles'
        if p == 'sw.js':
            return 'service_worker'
        if p == 'index.html':
            return 'html_csp'
        if p in ('app.config.json', 'system.meta.json'):
            return 'config'
        if p.startswith('tests/'):
            return 'tests'
        if p.lower().endswith(('.md',)):
            return 'docs'
        return 'other'

    cats = {}
    for k in ('added','modified','removed'):
        for x in changes.get(k, []):
            c = classify(x)
            cats[c] = cats.get(c, 0) + 1

    def cats_sentence(lang: str) -> str:
        labels = {
            'ui_footer': {'tr':'footer/UI', 'de':'Footer/UI', 'en':'footer/UI'},
            'ui_header': {'tr':'header/UI', 'de':'Header/UI', 'en':'header/UI'},
            'ui_sidebar': {'tr':'sidebar/UI', 'de':'Sidebar/UI', 'en':'sidebar/UI'},
            'release_mgmt': {'tr':'Sürüm Yönetimi', 'de':'Release Management', 'en':'Release Management'},
            'state': {'tr':'uygulama durumu', 'de':'App‑Zustand', 'en':'app state'},
            'loader': {'tr':'modül yükleyici', 'de':'Modul‑Loader', 'en':'module loader'},
            'i18n': {'tr':'çeviri', 'de':'Übersetzungen', 'en':'translations'},
            'automation': {'tr':'otomasyon', 'de':'Automatisierung', 'en':'automation'},
            'styles': {'tr':'stil/tasarım', 'de':'Styles', 'en':'styles'},
            'service_worker': {'tr':'servis çalışanı', 'de':'Service Worker', 'en':'service worker'},
            'html_csp': {'tr':'HTML/CSP', 'de':'HTML/CSP', 'en':'HTML/CSP'},
            'config': {'tr':'yapılandırma', 'de':'Konfiguration', 'en':'configuration'},
            'tests': {'tr':'testler', 'de':'Tests', 'en':'tests'},
            'docs': {'tr':'dokümantasyon', 'de':'Dokumentation', 'en':'documentation'},
            'other': {'tr':'diğer', 'de':'Sonstiges', 'en':'other'}
        }
        top = sorted(cats.items(), key=lambda kv: kv[1], reverse=True)
        names = [labels.get(k, labels['other'])[lang] for k,_ in top[:3]]
        return ', '.join(names) if names else ''

    def narrative(lang: str) -> str:
        phrases = {
            'ui_footer': {
                'tr': 'Footer görünümü ve davranışı sadeleştirildi; okunabilirlik ve tutarlılık iyileştirildi.',
                'de': 'Footer‑Darstellung und Verhalten verfeinert; Lesbarkeit und Konsistenz verbessert.',
                'en': 'Footer look and behavior refined; readability and consistency improved.'
            },
            'ui_header': {
                'tr': 'Üst bar etkileşimleri ve hizalamalar gözden geçirildi.',
                'de': 'Header‑Interaktionen und Ausrichtung überarbeitet.',
                'en': 'Header interactions and alignment reviewed.'
            },
            'ui_sidebar': {
                'tr': 'Sidebar geçişleri ve yerleşim düzeni optimize edildi.',
                'de': 'Sidebar‑Übergänge und Layout optimiert.',
                'en': 'Sidebar transitions and layout optimized.'
            },
            'release_mgmt': {
                'tr': 'Sürüm Yönetimi görünümü ve modallar daha anlaşılır hale getirildi; erişilebilirlik ve performans iyileştirildi.',
                'de': 'Release‑Management Ansicht und Modals klarer; Barrierefreiheit und Performance verbessert.',
                'en': 'Release Management view and modals clarified; accessibility and performance improved.'
            },
            'i18n': {
                'tr': 'Çeviri metinleri güncellendi; eksikler tamamlandı.',
                'de': 'Übersetzungen aktualisiert; fehlende Einträge ergänzt.',
                'en': 'Translations updated; missing entries filled.'
            },
            'automation': {
                'tr': 'Otomasyon betikleri güçlendirildi; sürüm açıklamaları daha bilgilendirici hale getirildi.',
                'de': 'Automationsskripte gestärkt; Release‑Beschreibungen informativer.',
                'en': 'Automation scripts hardened; release descriptions made more informative.'
            },
            'styles': {
                'tr': 'Tipografi ve boşluklar sayfa uyumu için düzenlendi.',
                'de': 'Typografie und Abstände für ein stimmiges Erscheinungsbild angepasst.',
                'en': 'Typography and spacing adjusted for visual harmony.'
            },
            'service_worker': {
                'tr': 'Offline önbellekleme ve güvenli istek stratejileri güncellendi.',
                'de': 'Offline‑Caching und sichere Request‑Strategien aktualisiert.',
                'en': 'Offline caching and safe request strategies updated.'
            },
            'loader': {
                'tr': 'Modül yükleyici ve içerik temizleme mantığı iyileştirildi.',
                'de': 'Modul‑Loader und Sanitizing verbessert.',
                'en': 'Module loader and sanitizing improved.'
            },
            'html_csp': {
                'tr': 'HTML/CSP ayarları sıkılaştırıldı.',
                'de': 'HTML/CSP‑Einstellungen gehärtet.',
                'en': 'HTML/CSP settings hardened.'
            },
            'config': {
                'tr': 'Yapılandırma bayrakları ve metadata senkronlandı.',
                'de': 'Konfigurations‑Flags und Metadaten synchronisiert.',
                'en': 'Configuration flags and metadata synchronized.'
            },
            'tests': {
                'tr': 'Test kapsamı genişletildi ve güvence artırıldı.',
                'de': 'Testabdeckung erweitert; Absicherung erhöht.',
                'en': 'Test coverage expanded; assurance increased.'
            },
            'docs': {
                'tr': 'Dokümantasyon netleştirildi.',
                'de': 'Dokumentation präzisiert.',
                'en': 'Documentation clarified.'
            }
        }
        top = [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]]
        lines = [phrases.get(k, {}).get(lang) for k in top]
        return ' '.join([l for l in lines if l])

    added_n = len(changes.get('added', []))
    modified_n = len(changes.get('modified', []))
    removed_n = len(changes.get('removed', []))

    # Notable files (3)
    notable_raw = changes.get('added', []) + changes.get('modified', []) + changes.get('removed', [])
    def friendly(p: str) -> str:
        if p.startswith('modules/'): return p.split('modules/',1)[1]
        if p.startswith('scripts/'): return p
        if p.startswith('locales/'): return p
        return p
    notable = ', '.join([friendly(p) for p in notable_raw[:3]])

    mods = set()
    for line in files_list:
        path = line.split(':',1)[-1].strip()
        if 'modules/' in path:
            parts = path.split('modules/',1)[-1].split('/')
            if parts:
                mods.add(parts[0])

    mods_txt = ', '.join(sorted(mods))

    def focus_sentence(lang: str) -> str:
        tag_map = {
            'ui_footer': {'tr':'UX', 'de':'UX', 'en':'UX'},
            'ui_header': {'tr':'UX', 'de':'UX', 'en':'UX'},
            'ui_sidebar': {'tr':'UX', 'de':'UX', 'en':'UX'},
            'styles': {'tr':'UX', 'de':'UX', 'en':'UX'},
            'release_mgmt': {'tr':'Sürüm Yönetimi', 'de':'Release Management', 'en':'Release Management'},
            'i18n': {'tr':'Yerelleştirme', 'de':'Lokalisierung', 'en':'Localization'},
            'automation': {'tr':'Otomasyon', 'de':'Automatisierung', 'en':'Automation'},
            'service_worker': {'tr':'Çevrimdışı', 'de':'Offline', 'en':'Offline'},
            'html_csp': {'tr':'Güvenlik', 'de':'Sicherheit', 'en':'Security'},
            'config': {'tr':'Yapılandırma', 'de':'Konfiguration', 'en':'Configuration'},
            'state': {'tr':'Uygulama Durumu', 'de':'App‑Zustand', 'en':'App State'},
            'loader': {'tr':'Altyapı', 'de':'Infrastruktur', 'en':'Infrastructure'},
            'tests': {'tr':'Kalite', 'de':'Qualität', 'en':'Quality'},
            'docs': {'tr':'Dokümantasyon', 'de':'Dokumentation', 'en':'Documentation'},
            'other': {'tr':'Genel', 'de':'Allgemein', 'en':'General'},
        }
        top = [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]]
        tags = [tag_map.get(k, tag_map['other'])[lang] for k in top]
        return ', '.join([t for t in tags if t])

    def build_desc(lang: str) -> str:
        core = narrative(lang)
        focus = focus_sentence(lang)
        if lang == 'tr':
            lines = [
                core,
                (f"Odak: {focus}." if focus else ''),
                (f"Etkilenen modüller: {mods_txt}." if mods_txt else ''),
                "Kararlılık ve performans iyileştirildi.",
                f"Değişiklik sayıları: +{added_n}, ~{modified_n}, -{removed_n}."
            ]
            if notable:
                lines.append(f"Öne çıkan dosyalar: {notable}.")
            return ' '.join([x for x in lines if x]).strip()
        if lang == 'de':
            lines = [
                core,
                (f"Schwerpunkte: {focus}." if focus else ''),
                (f"Betroffene Module: {mods_txt}." if mods_txt else ''),
                "Stabilität und Performance verbessert.",
                f"Änderungen: +{added_n}, ~{modified_n}, -{removed_n}."
            ]
            if notable:
                lines.append(f"Relevante Dateien: {notable}.")
            return ' '.join([x for x in lines if x]).strip()
        # en
        lines = [
            core,
            (f"Focus: {focus}." if focus else ''),
            (f"Affected modules: {mods_txt}." if mods_txt else ''),
            "Stability and performance improvements.",
            f"Changes: +{added_n}, ~{modified_n}, -{removed_n}."
        ]
        if notable:
            lines.append(f"Notable files: {notable}.")
        return ' '.join([x for x in lines if x]).strip()

    def compute_impact(cats):
        if 'html_csp' in cats or 'service_worker' in cats:
            return 'security'
        if 'release_mgmt' in cats or 'loader' in cats or 'state' in cats:
            return 'feature'
        if 'i18n' in cats or 'styles' in cats or 'ui_footer' in cats or 'ui_header' in cats or 'ui_sidebar' in cats:
            return 'ux'
        if 'automation' in cats:
            return 'chore'
        if 'tests' in cats:
            return 'quality'
        return 'chore'

    def compute_risk(counts, cats):
        total = (counts.get('added',0)+counts.get('modified',0)+counts.get('removed',0))
        if 'html_csp' in cats or total > 20:
            return 'high'
        if 'loader' in cats or 'state' in cats or total > 8:
            return 'medium'
        return 'low'

    def build_public(lang: str) -> str:
        # Public note: no file names, no internal jargon
        if lang == 'tr':
            parts = [
                narrative(lang),
                (f"Odak: {focus_sentence('tr')}" if cats_sentence('tr') else ''),
                "Stabilite ve deneyim daha iyi hale getirildi."
            ]
            return '. '.join([p for p in parts if p]).rstrip('.') + '.'
        if lang == 'de':
            parts = [
                narrative(lang),
                (f"Schwerpunkte: {focus_sentence('de')}" if cats_sentence('de') else ''),
                "Stabilität und Nutzererlebnis verbessert."
            ]
            return '. '.join([p for p in parts if p]).rstrip('.') + '.'
        parts = [
            narrative(lang),
            (f"Focus: {focus_sentence('en')}" if cats_sentence('en') else ''),
            "Stability and user experience improved."
        ]
        return '. '.join([p for p in parts if p]).rstrip('.') + '.'

    summary_tr = build_desc('tr')
    summary_de = build_desc('de')
    summary_en = build_desc('en')
    public_tr = build_public('tr')
    public_de = build_public('de')
    public_en = build_public('en')

    # categories keys (top 3)
    top_cats = [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]]
    impact = compute_impact(top_cats)
    risk = compute_risk({'added':added_n,'modified':modified_n,'removed':removed_n}, top_cats)

    # derive modules
    mods = set()
    for line in files_list:
        path = line.split(':',1)[-1].strip()
        if 'modules/' in path:
            parts = path.split('modules/',1)[-1].split('/')
            if parts:
                mods.add(parts[0])

    entry = {
        'version': nextv,
        'date': datetime.date.today().isoformat(),
        'time': datetime.datetime.now().strftime('%H:%M'),
        'datetime': datetime.datetime.utcnow().isoformat()+'Z',
        'status': 'Stable',
        'author': 'Local',
        'description': {
            'en': summary_en,
            'de': summary_de,
            'tr': summary_tr
        },
        'descriptionPublic': {
            'en': public_en,
            'de': public_de,
            'tr': public_tr
        },
        'modules': sorted(mods),
        'categories': top_cats,
        'counts': {'added': added_n, 'modified': modified_n, 'removed': removed_n},
        'filesTop': [friendly(p) for p in notable_raw[:3]],
        'impact': impact,
        'risk': risk,
        'quality': 'auto',
        'state': 'draft',
        'sources': ['watcher'],
        '_commit': 'HEAD',
        '_files': files_list[:50]
    }

    rel.insert(0, entry)
    write_json(REL, rel)

    pkg['version'] = nextv
    write_json(PKG, pkg)

    meta['version'] = nextv
    meta['buildDate'] = datetime.datetime.utcnow().isoformat()+'Z'
    write_json(META, meta)

    # Update module manifests
    for p in ROOT.glob('modules/**/module.manifest.json'):
        m = load_json(p, {}) or {}
        if 'version' in m:
            m['version'] = nextv
            write_json(p, m)

    print(f"[local-watch] release bumped to {nextv}")
    # Optional AI enhancement of summaries
    if os.environ.get('AI_SUMMARIZE','').lower() in ('1','true','yes'):
        try:
            os.system('node scripts/ai-release-summary.mjs --apply --top 1 > /dev/null 2>&1')
        except Exception:
            pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--interval', type=int, default=5, help='scan interval seconds')
    ap.add_argument('--cooldown', type=int, default=int(os.environ.get('RELEASE_COOLDOWN', '5')), help='debounce seconds before writing a release')
    args = ap.parse_args()

    prev = load_json(STATE, {}) or {}
    if not prev:
        prev = snapshot()
        write_json(STATE, prev)
        print('[local-watch] initial snapshot recorded')

    pending = {'added': [], 'modified': [], 'removed': []}
    last_change_ts = 0
    try:
        while True:
            time.sleep(args.interval)
            curr = snapshot()
            a, m, r = diff(prev, curr)
            # ignore if only state or release/meta files changed
            effective = [x for x in (a+m+r) if not any(x.endswith(s) for s in (
                'release-log.json','package.json','system.meta.json','module.manifest.json', '.local_release_state.json'))]
            if effective:
                pending['added'] += a
                pending['modified'] += m
                pending['removed'] += r
                last_change_ts = time.time()
            # debounce window: write only if quiet for cooldown seconds
            if pending['added'] or pending['modified'] or pending['removed']:
                if time.time() - last_change_ts >= args.cooldown:
                    apply_release(pending)
                    pending = {'added': [], 'modified': [], 'removed': []}
                    curr = snapshot()  # resnapshot after writing
            write_json(STATE, curr)
            prev = curr
    except KeyboardInterrupt:
        print('\n[local-watch] stopped')

if __name__ == '__main__':
    main()
