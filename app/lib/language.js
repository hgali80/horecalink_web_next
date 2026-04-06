import tr from "../locales/tr.json";
import ru from "../locales/ru.json";
import kz from "../locales/kz.json";
import en from "../locales/en.json";

export const defaultLanguage = "tr";
export const languageStorageKey = "hl_lang";

export const languageOptions = [
  { code: "kz", label: "Qazaqsha" },
  { code: "ru", label: "Russkiy" },
  { code: "tr", label: "Turkce" },
  { code: "en", label: "English" },
];

export const translationTables = {
  tr,
  ru,
  kz,
  en,
};

export function isSupportedLanguage(value) {
  return Object.prototype.hasOwnProperty.call(translationTables, value);
}

export function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") {
      return acc[key];
    }

    return undefined;
  }, obj);
}

export function translate(lang = defaultLanguage, key, params = {}) {
  const table = translationTables[lang] || translationTables[defaultLanguage];
  let text =
    table[key] ??
    getNestedValue(table, key) ??
    translationTables[defaultLanguage][key] ??
    getNestedValue(translationTables[defaultLanguage], key) ??
    key;

  if (typeof text !== "string") {
    return key;
  }

  Object.entries(params).forEach(([paramKey, value]) => {
    text = text.replaceAll(`{${paramKey}}`, String(value));
  });

  return text;
}
