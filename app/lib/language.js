import tr from "../locales/tr.json";
import ru from "../locales/ru.json";
import kz from "../locales/kz.json";
import en from "../locales/en.json";

export const defaultLanguage = "ru";
export const languageStorageKey = "hl_lang";

export const languageOptions = [
  { code: "kz", shortLabel: "KK", label: "Қазақша", flag: "/flags/kz.svg" },
  { code: "ru", shortLabel: "RU", label: "Русский", flag: "/flags/ru.svg" },
  { code: "tr", shortLabel: "TR", label: "Türkçe", flag: "/flags/tr.svg" },
  { code: "en", shortLabel: "EN", label: "English", flag: "/flags/gb.svg" },
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
