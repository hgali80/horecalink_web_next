import assert from "node:assert/strict";
import {
  buildChatgptCommerceProduct,
  CHATGPT_COMMERCE_FEED_COLUMNS,
  serializeChatgptCommerceCsv,
} from "../app/lib/server/chatgptCommerceFeed.mjs";

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = input.charCodeAt(0) === 0xFEFF ? 1 : 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

const product = {
  id: "doc-id", sku: "00042", name_ru: "Стол, профессиональный",
  description_ru: "Стол из нержавеющей стали",
  specs_ru: 'Размеры: 1200 мм, "глубина" 600 мм', brand: "HorecaLink",
  price: 125000, slug: "steel-table", image_names: ["00042.jpg"],
  active: true, webPublished: true, saleEnabled: true, stockTracked: true, productType: "sale_item",
};
const included = buildChatgptCommerceProduct(product, { rQty: 2, fQty: 1 });
assert.ok(included);
assert.equal(included.item_id, "00042");
assert.equal(included.price, "125000 KZT");
assert.equal(included.target_countries, '["KZ"]');
assert.equal(included.store_country, "KZ");
assert.match(included.description, /Стол из нержавеющей стали/);
assert.match(included.description, /Размеры/);
assert.match(included.url, /^https:\/\//);
assert.match(included.image_url, /^https:\/\//);
assert.equal(buildChatgptCommerceProduct(product, { rQty: 0, fQty: 0 }), null);
assert.equal(buildChatgptCommerceProduct({ ...product, saleEnabled: false }, { rQty: 1 }), null);
assert.equal(buildChatgptCommerceProduct({ ...product, brand: "" }, { rQty: 1 }), null);
assert.equal(buildChatgptCommerceProduct({ ...product, description_ru: "", description: "Turkish text", specs_ru: "" }, { rQty: 1 }), null);
assert.equal(buildChatgptCommerceProduct({ ...product, stockTracked: false }, { rQty: 1 }), null);

const csv = serializeChatgptCommerceCsv([included]);
assert.equal(csv.charCodeAt(0), 0xFEFF);
assert.equal(csv.split("\r\n")[0].slice(1), CHATGPT_COMMERCE_FEED_COLUMNS.join(","));
assert.match(csv, /"Стол, профессиональный"/);
assert.ok(csv.includes('"Стол из нержавеющей стали\nРазмеры: 1200 мм, ""глубина"" 600 мм"'));
assert.equal(csv.split("\r\n").length, 3);
console.log(`Validated ${CHATGPT_COMMERCE_FEED_COLUMNS.length} columns, SKU preservation, KZ/KZT, Russian text, HTTPS URLs, inventory eligibility, and CSV escaping.`);

if (process.argv[2]) {
  const response = await fetch(process.argv[2]);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/csv; charset=utf-8/);
  const parsed = parseCsv(await response.text());
  const [headers, ...records] = parsed;
  assert.deepEqual(headers, CHATGPT_COMMERCE_FEED_COLUMNS);
  const invalid = records.filter((values) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return headers.some((header) => !row[header]) ||
      row.availability !== "in_stock" || !/^\d+(?:\.\d{1,2})? KZT$/.test(row.price) ||
      row.target_countries !== '["KZ"]' || row.store_country !== "KZ" ||
      !row.url.startsWith("https://") || !row.image_url.startsWith("https://") ||
      !/[А-Яа-яЁё]/.test(row.description);
  });
  assert.equal(invalid.length, 0);
  console.log(`HTTP feed validated: ${records.length} product rows; ${invalid.length} invalid rows.`);
}
