/**
 * MP-18 Fix Pack: merge project-level locales into runtime dictionary without overwriting
 * keys registered by feature modules.
 */
import de from "../../locales/de.json";
import en from "../../locales/en.json";
import tr from "../../locales/tr.json";

type Dict = Record<string, Record<string, string>>;
const g = globalThis as any;
const dict: Dict = g.__TP_I18N__ || (g.__TP_I18N__ = { de: {}, en: {}, tr: {} });

function merge(lang: "de" | "en" | "tr", src: Record<string, string>) {
  dict[lang] = dict[lang] || {};
  for (const [key, value] of Object.entries(src)) {
    if (!(key in dict[lang])) {
      dict[lang][key] = value;
    }
  }
}

merge("de", de);
merge("en", en);
merge("tr", tr);

g.__TP_I18N__ = dict;
