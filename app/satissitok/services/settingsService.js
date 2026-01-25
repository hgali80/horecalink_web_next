//app/satissitok/services/settingsService.js
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

const SETTINGS_REF = doc(db, "satissitok_settings", "main");

const cleanArray = (arr) =>
  (arr || [])
    .filter(
      (x) =>
        x &&
        typeof x.label === "string" &&
        x.label.trim() !== "" &&
        typeof x.rate === "number" &&
        !Number.isNaN(x.rate)
    )
    .map((x) => {
      const obj = {
        label: x.label.trim(),
        rate: Number(x.rate),
      };

      if (x.key) obj.key = x.key;
      if (x.active !== undefined) obj.active = !!x.active;
      if (x.default === true) obj.default = true;

      return obj;
    });

const DEFAULT_SETTINGS = {
  units: [
    { key: "adet", label: "Adet", active: true },
    { key: "rulon", label: "Rulon", active: true },
    { key: "kutu", label: "Kutu", active: true },
  ],
  taxes: {
    vat: [{ label: "KDV %16", rate: 16, default: true }],
    income: [{ label: "Gelir Vergisi %3", rate: 3 }],
  },
};

export async function getSettings() {
  try {
    const snap = await getDoc(SETTINGS_REF);

    if (!snap.exists()) {
      await setDoc(SETTINGS_REF, DEFAULT_SETTINGS, { merge: true });
      return DEFAULT_SETTINGS;
    }

    return snap.data();
  } catch (err) {
    console.error("getSettings error:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(data) {
  try {
    const payload = {
      units: cleanArray(data.units),
      taxes: {
        vat: cleanArray(data.taxes?.vat),
        income: cleanArray(data.taxes?.income),
      },
    };

    await setDoc(SETTINGS_REF, payload, { merge: true });
  } catch (err) {
    console.error("saveSettings error:", err);
    throw err;
  }
}
