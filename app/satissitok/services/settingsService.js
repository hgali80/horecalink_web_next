//app/satissitok/services/settingsService.js

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

const SETTINGS_REF = doc(db, "settings", "main");
const LEGACY_SETTINGS_REF = doc(db, "satissitok_settings", "main");

const cleanText = (v) => (typeof v === "string" ? v.trim() : "");

const cleanList = (arr) => (Array.isArray(arr) ? arr : []);

const cleanUnits = (arr) =>
  cleanList(arr)
    .map((x) => ({
      key: cleanText(x?.key),
      label: cleanText(x?.label),
      active: x?.active !== false,
      default: x?.default === true,
    }))
    .filter((x) => x.key && x.label);

const cleanPlatforms = (arr) =>
  cleanList(arr)
    .map((x) => ({
      key: cleanText(x?.key),
      label: cleanText(x?.label),
      active: x?.active !== false,
      default: x?.default === true,
    }))
    .filter((x) => x.key && x.label);

const cleanWarehouses = (arr) =>
  cleanList(arr)
    .map((x) => ({
      key: cleanText(x?.key),
      label: cleanText(x?.label),
      active: x?.active !== false,
      default: x?.default === true,
    }))
    .filter((x) => x.key && x.label);

const cleanRates = (arr) =>
  cleanList(arr)
    .map((x) => ({
      label: cleanText(x?.label),
      rate: Number(x?.rate ?? 0),
      default: x?.default === true,
      active: x?.active !== false,
    }))
    .filter((x) => x.label && Number.isFinite(x.rate));

const DEFAULT_SETTINGS = {
  units: [
    { key: "adet", label: "Adet", active: true, default: true },
    { key: "rulon", label: "Rulon", active: true },
    { key: "kutu", label: "Kutu", active: true },
  ],
  warehouses: [
    { key: "main", label: "Ana Depo", active: true, default: true },
    { key: "backup", label: "Yedek Depo", active: true },
  ],
  platforms: [
    { key: "showroom", label: "Showroom", active: true, default: true },
    { key: "kaspi", label: "Kaspi Magazin", active: true },
    { key: "ozon", label: "Ozon", active: true },
  ],
  taxes: {
    vat: [{ label: "KDV %16", rate: 16, default: true, active: true }],
    income: [{ label: "Gelir Vergisi %3", rate: 3, active: true }],
  },
};

function isPermissionError(err) {
  const code = String(err?.code || "");
  return code === "permission-denied" || /insufficient permissions/i.test(String(err?.message || ""));
}

async function readLegacySettings() {
  try {
    const snap = await getDoc(LEGACY_SETTINGS_REF);
    return snap.exists() ? snap.data() || null : null;
  } catch (err) {
    if (isPermissionError(err)) return null;
    throw err;
  }
}

export async function getSettings() {
  try {
    const snap = await getDoc(SETTINGS_REF);

    if (!snap.exists()) {
      const legacyData = await readLegacySettings();
      const seededSettings = legacyData || DEFAULT_SETTINGS;
      await setDoc(SETTINGS_REF, seededSettings, { merge: true });
      return seededSettings;
    }

    const s = snap.data() || {};
    const merged = {
      ...DEFAULT_SETTINGS,
      ...s,
      units: cleanUnits(s.units ?? DEFAULT_SETTINGS.units),
      warehouses: cleanWarehouses(s.warehouses ?? DEFAULT_SETTINGS.warehouses),
      platforms: cleanPlatforms(s.platforms ?? DEFAULT_SETTINGS.platforms),
      taxes: {
        vat: cleanRates(s.taxes?.vat ?? DEFAULT_SETTINGS.taxes.vat),
        income: cleanRates(s.taxes?.income ?? DEFAULT_SETTINGS.taxes.income),
      },
    };

    // default olmayan varsa ilk aktif olanı default yap (koruma)
    if (!merged.taxes.vat.some((x) => x.default === true) && merged.taxes.vat.length) {
      merged.taxes.vat[0].default = true;
    }
    if (!merged.platforms.some((x) => x.default === true) && merged.platforms.length) {
      merged.platforms[0].default = true;
    }
    if (!merged.units.some((x) => x.default === true) && merged.units.length) {
      merged.units[0].default = true;
    }
    if (!merged.warehouses.some((x) => x.default === true) && merged.warehouses.length) {
      merged.warehouses[0].default = true;
    }

    return merged;
  } catch (err) {
    if (!isPermissionError(err)) {
      console.error("getSettings error:", err);
    }
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(data) {
  try {
    const payload = {
      units: cleanUnits(data?.units),
      warehouses: cleanWarehouses(data?.warehouses),
      platforms: cleanPlatforms(data?.platforms),
      taxes: {
        vat: cleanRates(data?.taxes?.vat),
        income: cleanRates(data?.taxes?.income),
      },
    };

    // en az 1 default garanti
    if (payload.units.length && !payload.units.some((x) => x.default)) {
      payload.units[0].default = true;
    }
    if (payload.platforms.length && !payload.platforms.some((x) => x.default)) {
      payload.platforms[0].default = true;
    }
    if (payload.warehouses.length && !payload.warehouses.some((x) => x.default)) {
      payload.warehouses[0].default = true;
    }
    if (payload.taxes.vat.length && !payload.taxes.vat.some((x) => x.default)) {
      payload.taxes.vat[0].default = true;
    }

    await setDoc(SETTINGS_REF, payload, { merge: true });
  } catch (err) {
    console.error("saveSettings error:", err);
    throw err;
  }
}
