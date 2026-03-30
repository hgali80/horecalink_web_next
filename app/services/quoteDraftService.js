const STORAGE_KEY = "horecalink_quote_draft";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeQty(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

export function getQuoteDraft() {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuoteDraft(items) {
  if (!isBrowser()) return [];

  const normalized = Array.isArray(items)
    ? items
        .filter((item) => item?.productId)
        .map((item) => ({
          productId: String(item.productId),
          quantity: normalizeQty(item.quantity),
        }))
    : [];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("quote-draft-updated"));

  return normalized;
}

export function addToQuoteDraft(productId, quantity = 1) {
  const current = getQuoteDraft();
  const normalizedProductId = String(productId);
  const normalizedQuantity = normalizeQty(quantity);

  const index = current.findIndex((item) => item.productId === normalizedProductId);

  if (index >= 0) {
    current[index] = {
      ...current[index],
      quantity: current[index].quantity + normalizedQuantity,
    };
  } else {
    current.push({
      productId: normalizedProductId,
      quantity: normalizedQuantity,
    });
  }

  return saveQuoteDraft(current);
}

export function updateQuoteDraftItem(productId, quantity) {
  const current = getQuoteDraft();
  const normalizedProductId = String(productId);
  const normalizedQuantity = normalizeQty(quantity);

  const next = current.map((item) =>
    item.productId === normalizedProductId
      ? { ...item, quantity: normalizedQuantity }
      : item
  );

  return saveQuoteDraft(next);
}

export function removeFromQuoteDraft(productId) {
  const next = getQuoteDraft().filter((item) => item.productId !== String(productId));
  return saveQuoteDraft(next);
}

export function clearQuoteDraft() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("quote-draft-updated"));
}

export function getQuoteDraftCount() {
  return getQuoteDraft().reduce((sum, item) => sum + normalizeQty(item.quantity), 0);
}
