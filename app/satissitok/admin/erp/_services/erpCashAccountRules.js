export function assertErpCashAccountUsable(account, currency = "KZT") {
  if (account.active === false) throw new Error("Pasif hesap ile yeni islem yapilamaz.");
  if (String(account.currency || "KZT").trim().toUpperCase() !== currency) {
    throw new Error("Bu islem icin KZT cinsinden bir kasa veya banka hesabi secmelisin.");
  }
}

export function buildErpCashAccountWrite(payload, existing = null) {
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("Hesap adi zorunlu.");
  if (!["cash", "bank"].includes(payload.type)) throw new Error("Gecersiz hesap tipi.");
  const openingBalance = Number(payload.openingBalance || 0);
  if (!existing && !Number.isFinite(openingBalance)) throw new Error("Acilis bakiyesi gecerli bir sayi olmali.");
  if (!existing && String(payload.currency || "KZT").trim().toUpperCase() !== "KZT") {
    throw new Error("Yeni ERP hesaplari KZT cinsinden olusturulmalidir.");
  }
  const fields = {
    code: String(payload.code || "").trim(), name, type: payload.type,
    notes: String(payload.notes || "").trim(), active: payload.active !== false,
  };
  // Metadata edits must never overwrite a balance changed by another transaction.
  if (!existing) Object.assign(fields, {
    currency: "KZT", openingBalance: Math.round(openingBalance * 100) / 100,
    currentBalance: Math.round(openingBalance * 100) / 100,
  });
  return fields;
}
