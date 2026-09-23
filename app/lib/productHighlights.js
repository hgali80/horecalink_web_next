// Translate only the old, built-in UI copy. Product-specific text stays intact.
const legacyHighlights = [
  ["Bu urun HoReCa operasyonlarinda yogun kullanim icin uygundur.", "productDetail.highlight.professionalText"],
  ["Kart bilgileri Firestore katalog verisinden otomatik olusturulur.", "productDetail.highlight.updatedText"],
  ["Ticari teklif talebinizi tek tikla iletebilirsiniz.", "productDetail.highlight.fastQuoteText"],
];

function normalize(value) {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

const legacyKeys = new Map(legacyHighlights.map(([text, key]) => [normalize(text), key]));

export function getProductHighlightLines(value, t) {
  const defaults = legacyHighlights.map(([, key]) => t(key));
  const text = String(value ?? "").trim();
  const lines = text && text.toLowerCase() !== "null"
    ? text.replace(/\s{2,}/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3)
    : [];

  return defaults.map((fallback, index) => {
    const line = lines[index];
    if (!line) return fallback;
    const key = legacyKeys.get(normalize(line));
    return key ? t(key) : line;
  });
}
