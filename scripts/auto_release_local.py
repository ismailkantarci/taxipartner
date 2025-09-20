#!/usr/bin/env python3
import json, subprocess, datetime, os, sys, re

def sh(cmd):
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL)
        return out.decode('utf-8').strip()
    except Exception:
        return ''

def bump_patch(v):
    parts = [int(x) if x.isdigit() else 0 for x in str(v or '0.0.0').split('.')]
    while len(parts)<3: parts.append(0)
    parts[2]+=1
    return '.'.join(map(str, parts))

def load_json(path, fallback=None):
    try:
        with open(path,'r',encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return fallback

def write_json(path, obj):
    with open(path,'w',encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')

def in_freeze(root_dir):
    cal = os.path.join(root_dir, 'release-calendar.yml')
    if not os.path.exists(cal):
        return False
    try:
        with open(cal,'r',encoding='utf-8') as f:
            txt = f.read()
        starts = re.findall(r'^\s*start:\s*"?([0-9T:.-]+Z)"?', txt, flags=re.M)
        ends = re.findall(r'^\s*end:\s*"?([0-9T:.-]+Z)"?', txt, flags=re.M)
        now = datetime.datetime.utcnow()
        for s,e in zip(starts, ends):
            try:
                sdt = datetime.datetime.fromisoformat(s.replace('Z',''))
                edt = datetime.datetime.fromisoformat(e.replace('Z',''))
                if sdt <= now <= edt:
                    return True
            except Exception:
                pass
    except Exception:
        return False
    return False

# Paths
pkg_path = 'package.json'
meta_path = 'system.meta.json'
rel_path = 'modules/ReleaseManagement/release-log.json'

pkg = load_json(pkg_path, {})
rel = load_json(rel_path, []) or []
meta = load_json(meta_path, {}) or {}

prev = pkg.get('version') or (rel and rel[0].get('version')) or '0.0.0'

if os.environ.get('RELEASE_EXCEPTION','').lower() not in ('1','true','yes'):
    if in_freeze(os.getcwd()):
        print('[pre-commit] in freeze window, skipping release bump (set RELEASE_EXCEPTION=true to override)')
        sys.exit(0)
nextv = bump_patch(prev)

# Gather a basic summary from staged changes
files = [f for f in sh('git diff --cached --name-only').splitlines() if f]
mods = sorted({ (f.split('modules/',1)[-1].split('/')[0]) for f in files if 'modules/' in f })

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
for f in files:
    c = classify(f)
    cats[c] = cats.get(c,0)+1

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

added_n = len([f for f in files if f])
modified_n = added_n  # in pre-commit, we don't separate; treat as modified
removed_n = 0

mods_txt = ', '.join(mods)

def narrative(lang: str) -> str:
    phrases = {
        'ui_footer': {'tr':'Footer görünümü sadeleştirildi; okunabilirlik ve tutarlılık artırıldı.', 'de':'Footer verfeinert; Lesbarkeit und Konsistenz verbessert.', 'en':'Footer refined; readability and consistency improved.'},
        'ui_header': {'tr':'Üst bar etkileşimleri düzenlendi.', 'de':'Header‑Interaktionen angepasst.', 'en':'Header interactions adjusted.'},
        'ui_sidebar': {'tr':'Sidebar geçiş ve yerleşimi optimize edildi.', 'de':'Sidebar optimiert.', 'en':'Sidebar optimized.'},
        'release_mgmt': {'tr':'Sürüm Yönetimi görünümü ve modallar iyileştirildi.', 'de':'Release‑Management verbessert.', 'en':'Release Management view and modals improved.'},
        'i18n': {'tr':'Çeviri metinleri güncellendi; eksikler tamamlandı.', 'de':'Übersetzungen aktualisiert; fehlende Einträge ergänzt.', 'en':'Translations updated; missing entries filled.'},
        'automation': {'tr':'Otomasyon betikleri güçlendirildi; sürüm açıklamaları zenginleştirildi.', 'de':'Automationsskripte gestärkt; Beschreibungen verbessert.', 'en':'Automation hardened; release descriptions enhanced.'},
        'styles': {'tr':'Tipografi ve boşluklar uyum için ayarlandı.', 'de':'Typografie und Abstände angepasst.', 'en':'Typography and spacing tuned for harmony.'},
        'service_worker': {'tr':'Offline önbellekleme/güvenli istek stratejileri güncellendi.', 'de':'Offline‑Caching/sichere Strategien aktualisiert.', 'en':'Offline caching/safe request strategies updated.'},
        'loader': {'tr':'Modül yükleyici/sanitize iyileştirildi.', 'de':'Loader/Sanitizing verbessert.', 'en':'Module loader and sanitizing improved.'},
        'html_csp': {'tr':'HTML/CSP ayarları sıkılaştırıldı.', 'de':'HTML/CSP gehärtet.', 'en':'HTML/CSP hardened.'},
        'config': {'tr':'Yapılandırma bayrakları ve metadata senkronlandı.', 'de':'Konfigurations‑Flags und Metadaten synchronisiert.', 'en':'Configuration flags and metadata synchronized.'},
        'tests': {'tr':'Test kapsamı genişletildi; güvence artırıldı.', 'de':'Testabdeckung erweitert; Absicherung erhöht.', 'en':'Test coverage expanded; assurance increased.'},
        'docs': {'tr':'Dokümantasyon netleştirildi.', 'de':'Dokumentation präzisiert.', 'en':'Documentation clarified.'}
    }
    top = [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]]
    return ' '.join([phrases.get(k, {}).get(lang) for k in top if phrases.get(k, {}).get(lang)])

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
        'other': {'tr':'Genel', 'de':'Allgemein', 'en':'General'}
    }
    top = [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]]
    tags = [tag_map.get(k, tag_map['other'])[lang] for k in top]
    return ', '.join([t for t in tags if t])

def build_desc(lang: str) -> str:
    core = narrative(lang)
    focus = focus_sentence(lang)
    if lang == 'tr':
        lines = [core,
                 (f'Odak: {focus}.' if focus else ''),
                 (f'Etkilenen modüller: {mods_txt}.' if mods_txt else ''),
                 'Kararlılık ve performans iyileştirildi.',
                 f'Değişiklik sayıları: ~{modified_n}.']
        return ' '.join([x for x in lines if x]).strip()
    if lang == 'de':
        lines = [core,
                 (f'Schwerpunkte: {focus}.' if focus else ''),
                 (f'Betroffene Module: {mods_txt}.' if mods_txt else ''),
                 'Stabilität und Performance verbessert.',
                 f'Änderungen: ~{modified_n}.']
        return ' '.join([x for x in lines if x]).strip()
    lines = [core,
             (f'Focus: {focus}.' if focus else ''),
             (f'Affected modules: {mods_txt}.' if mods_txt else ''),
             'Stability and performance improvements.',
             f'Changes: ~{modified_n}.']
    return ' '.join([x for x in lines if x]).strip()

summary_en = build_desc('en')
summary_de = build_desc('de')
summary_tr = build_desc('tr')
now = datetime.datetime.now()
utc = datetime.datetime.utcnow()

entry = {
    'version': nextv,
    'date': datetime.date.today().isoformat(),
    'time': now.strftime('%H:%M'),
    'datetime': utc.isoformat()+'Z',
    'status': 'Stable',
    'author': sh('git config user.name') or 'Local',
    'description': {
        'en': summary_en,
        'de': summary_de,
        'tr': summary_tr
    },
    'descriptionPublic': {
        'en': (narrative('en') + (' ' + ('Focus: ' + cats_sentence('en') + '.') if cats_sentence('en') else '') + ' Stability and user experience improved.').strip(),
        'de': (narrative('de') + (' ' + ('Schwerpunkte: ' + cats_sentence('de') + '.') if cats_sentence('de') else '') + ' Stabilität und Nutzererlebnis verbessert.').strip(),
        'tr': (narrative('tr') + (' ' + ('Odak: ' + cats_sentence('tr') + '.') if cats_sentence('tr') else '') + ' Stabilite ve deneyim daha iyi hale getirildi.').strip()
    },
    'modules': mods,
    'categories': [k for k,_ in sorted(cats.items(), key=lambda kv: kv[1], reverse=True)[:3]],
    'counts': {'added': 0, 'modified': modified_n, 'removed': 0},
    'filesTop': files[:3],
    'quality': 'auto',
    'state': 'draft',
    'sources': ['pre-commit'],
    '_commit': 'HEAD'
}

# Prepend new entry if differs
if not rel or rel[0].get('version') != nextv:
    rel.insert(0, entry)
    write_json(rel_path, rel)

pkg['version'] = nextv
write_json(pkg_path, pkg)

meta['version'] = nextv
meta['buildDate'] = datetime.datetime.utcnow().isoformat()+'Z'
write_json(meta_path, meta)

# Update module manifests versions
import glob
for path in glob.glob('modules/**/module.manifest.json', recursive=True):
    m = load_json(path, {}) or {}
    if 'version' in m:
        m['version'] = nextv
        write_json(path, m)

print(f'Local auto-release bumped to {nextv}')
