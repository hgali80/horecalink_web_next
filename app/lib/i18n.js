// app/lib/i18n.js
import { defaultLanguage, translate } from "./language";

export function getT(lang = defaultLanguage) {
  return function t(key, params = {}) {
    return translate(lang, key, params);
  };
}
