import de from '../../locales/de.json';
import en from '../../locales/en.json';
import tr from '../../locales/tr.json';

type Dict = Record<string, Record<string, string>>;
const g = globalThis as any;
const base: Dict = g.__TP_I18N__ || (g.__TP_I18N__ = { de: {}, en: {}, tr: {} });

function merge(lang: 'de' | 'en' | 'tr', src: Record<string, string>) {
  base[lang] = base[lang] || {};
  for (const [key, value] of Object.entries(src || {})) {
    if (!(key in base[lang])) {
      base[lang][key] = value;
    }
  }
}

merge('de', de);
merge('en', en);
merge('tr', tr);

g.__TP_I18N__ = base;

