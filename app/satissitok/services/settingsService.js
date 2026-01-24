//app/satissitok/services/settingsService.js
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

const SETTINGS_REF = doc(db, "satissitok_settings", "main");

const DEFAULT_SETTINGS = {
  units: [
    { key: "adet", label: "Adet", active: true },
    { key: "rulon", label: "Rulon", active: true },
    { key: "kutu", label: "Kutu", active: true },
  ],
  taxes: {
    vat: [
      { label: "KDV %16", rate: 16, default: true },
      { label: "KDV %0", rate: 0 },
    ],
    income: [
      { label: "Gelir Vergisi %3", rate: 3 },
    ],
  },
};

export async function getSettings() {
  try {
    const snap = await getDoc(SETTINGS_REF);

    if (!snap.exists()) {
      // ❗ merge YOK, serverTimestamp YOK
      await setDoc(SETTINGS_REF, DEFAULT_SETTINGS);
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
    // ❗ merge YOK, timestamp YOK
    await setDoc(SETTINGS_REF, data);
  } catch (err) {
    console.error("saveSettings error:", err);
    throw err;
  }
}
