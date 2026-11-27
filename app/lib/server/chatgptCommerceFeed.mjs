const BASE_URL = "https://horecalink.kz";
const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

export const CHATGPT_COMMERCE_FEED_COLUMNS = Object.freeze([
  "item_id",
  "title",
  "description",
  "url",
  "brand",
  "seller_name",
  "image_url",
  "availability",
  "price",
  "target_countries",
  "store_country",
]);

function clean(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return !text || text.toLowerCase() === "null" ? "" : text;
}

function httpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function productImageUrl(product) {
  const names = Array.isArray(product.image_names)
    ? product.image_names
    : clean(product.image_names).split(/[\n,;]+/);
  let image = names.map(clean).find(Boolean);
  if (!image) image = clean(product.imageBase);
  if (!image) return "";
  if (!/\.[a-z0-9]+$/i.test(image)) image += ".jpg";
  return httpsUrl(`https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(image)}?alt=media`);
}

function russianDescription(product) {
  const russianText = (value) => {
    const text = clean(value);
    return /[А-Яа-яЁё]/.test(text) ? text : "";
  };
  const description = russianText(product.description_ru || product.shortDescription_ru || product.description || product.shortDescription || product.specs_ru);
  const explicitSpecs = russianText(product.specs_ru || product.technicalDetails_ru || product.technical_specs_ru || product.specs);
  const specParts = [
    explicitSpecs,
    russianText(product.material_ru) ? `Материал: ${russianText(product.material_ru)}` : "",
    russianText(product.dimensions_ru) ? `Размеры: ${russianText(product.dimensions_ru)}` : "",
    russianText(product.capacity_ru) ? `Объем: ${russianText(product.capacity_ru)}` : "",
    russianText(product.power_ru) ? `Мощность: ${russianText(product.power_ru)}` : "",
    russianText(product.voltage_ru) ? `Напряжение: ${russianText(product.voltage_ru)}` : "",
    russianText(product.fuelType_ru) ? `Тип топлива: ${russianText(product.fuelType_ru)}` : "",
    russianText(product.weight_ru) ? `Вес: ${russianText(product.weight_ru)}` : "",
    russianText(product.warranty_ru) ? `Гарантия: ${russianText(product.warranty_ru)}` : "",
  ].filter(Boolean);
  return [description, ...specParts.filter((part) => part !== description)].filter(Boolean).join("\n");
}

function money(value) {
  if (typeof value !== "number" && typeof value !== "string") return "";
  const amount = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return "";
  return `${amount} KZT`;
}

export function buildChatgptCommerceProduct(product, stockBalance = {}) {
  if (product?.active !== true || product?.webPublished !== true || product?.saleEnabled === false) return null;
  if (product?.productType && product.productType !== "sale_item") return null;

  const stockTotal = Number(stockBalance?.rQty || 0) + Number(stockBalance?.fQty || 0);
  if (product?.stockTracked === false || !Number.isFinite(stockTotal) || stockTotal <= 0) return null;

  const itemId = clean(product.sku);
  const title = clean(product.name_ru || product.name);
  const description = russianDescription(product);
  const brand = clean(product.brand);
  const price = money(product.price);
  const slug = clean(product.slug || product.id);
  const url = slug ? httpsUrl(`${BASE_URL}/products/${encodeURIComponent(slug)}`) : "";
  const imageUrl = productImageUrl(product);

  if (![itemId, title, description, brand, price, url, imageUrl].every(Boolean)) return null;

  return {
    item_id: itemId,
    title,
    description,
    url,
    brand,
    seller_name: "HorecaLink",
    image_url: imageUrl,
    availability: "in_stock",
    price,
    target_countries: "[\"KZ\"]",
    store_country: "KZ",
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeChatgptCommerceCsv(rows) {
  const lines = [CHATGPT_COMMERCE_FEED_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CHATGPT_COMMERCE_FEED_COLUMNS.map((column) => csvCell(row[column])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
