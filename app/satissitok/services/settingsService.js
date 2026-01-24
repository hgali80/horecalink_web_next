//app/satissitok/services/settingsService.js
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

const SETTINGS_REF = doc(db, "satissitok_settings", "main");

const DEFAULT_SETTINGS = {
  units: [
    { key: "adet", label: "Adet", active: true },
    { key: "rulon", label: "Rulon", active: true },
    { key: "kg", label: "Kg", active: true },
    { key: "kutu", label: "Kutu", active: true },
  ],
  taxes: {
    vat: [
      { label: "KDV %12", rate: 12, default: true },
      { label: "KDV %0", rate: 0 },
    ],
    income: [
      { label: "Gelir Vergisi %10", rate: 10 },
      { label: "Gelir Vergisi %20", rate: 20 },
    ],
  },
  updatedAt: serverTimestamp(),
};

export async function getSettings() {
  const snap = await getDoc(SETTINGS_REF);
  if (!snap.exists()) {
    await setDoc(SETTINGS_REF, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return snap.data();
}

export async function saveSettings(data) {
  await setDoc(
    SETTINGS_REF,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
