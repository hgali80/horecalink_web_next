// app/lib/i18n.js
import tr from "../locales/tr.json";
import ru from "../locales/ru.json";
import kz from "../locales/kz.json";
import en from "../locales/en.json";

const DICT = { tr, ru, kz, en };

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") {
      return acc[key];
    }
    return undefined;
  }, obj);
}

export function getT(lang = "tr") {
  const table = DICT[lang] || DICT.tr;

  return function t(key, params = {}) {
    let text =
      getNested(table, key) ??
      getNested(DICT.tr, key) ??
      key;

    if (typeof text !== "string") return key;

    Object.keys(params).forEach((p) => {
      text = text.replace(`{${p}}`, params[p]);
    });

    return text;
  };
}
