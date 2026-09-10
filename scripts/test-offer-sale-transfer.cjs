// node scripts/test-offer-sale-transfer.cjs
// Runs the real conversion and document services without production credentials.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const base = path.join(__dirname, "../app/satissitok/admin/erp/_services");
const records = new Map();
const versions = new Map();
let sequence = 0;
let failCommit = false;
let retries = 0;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const put = (key, value) => { records.set(key, clone(value)); versions.set(key, (versions.get(key) || 0) + 1); };
const snapshot = ref => {
  const value = clone(records.get(ref.path));
  return { id: ref.id, exists: () => value !== undefined, data: () => value };
};
const products = [{ id: "p1", sku: "SKU-1", price: 999999, stockTracked: true, saleEnabled: true }];
const context = vm.createContext({
  db: {}, collection: (_, name) => name,
  doc: (...args) => {
    const key = args.length === 1 ? `${args[0]}/test-${++sequence}` : `${args[1]}/${args[2]}`;
    return { path: key, id: key.split("/").at(-1) };
  },
  query: (name, ...filters) => ({ name, filters }),
  where: (field, op, value) => ({ field, op, value }),
  getDocs: async query => ({ docs: [...records.keys()]
    .filter(key => key.startsWith(query.name + "/") && query.filters.every(filter => records.get(key)[filter.field] === filter.value))
    .map(key => snapshot({ path: key, id: key.split("/").at(-1) })) }),
  listErpProductOptions: async () => clone(products),
  serverTimestamp: () => "2026-09-07T12:00:00Z",
  buildCounterDocId: ({ kind, docType, counterType, yy }) => `${kind}-${docType}-${counterType}-${yy}`,
  formatCounterNumber: ({ prefix, yy, seq }) => `${prefix}-${yy}-${seq}`,
  getNumberPrefix: (_, kind, type, counter) => `${kind}-${type}-${counter}`,
  runTransaction: async (_, callback) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const writes = [];
      const reads = new Map();
      const result = await callback({
        get: async ref => {
          assert.equal(writes.length, 0, "All Firestore reads must precede writes");
          reads.set(ref.path, versions.get(ref.path) || 0);
          return snapshot(ref);
        },
        set: (ref, fields, options) => writes.push([ref.path, clone(fields), options]),
      });
      if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) { retries++; continue; }
      if (failCommit) throw new Error("Simulated network failure");
      for (const [key, fields, options] of writes) put(key, { ...(options?.merge ? records.get(key) : {}), ...fields });
      return result;
    }
    throw new Error("Transaction retry limit");
  },
});
for (const [file, exports] of [
  ["erpCollections.js", ["ERP_COLLECTIONS"]],
  ["erpVat.js", ["calculateErpVatLine", "summarizeErpVat"]],
  ["erpOfferConversion.js", ["buildErpSaleFromOffer"]],
  ["erpDocumentMutationService.js", ["convertCommercialOfferToSale", "saveErpDraftDocument", "confirmErpDocument"]],
]) {
  const source = fs.readFileSync(path.join(base, file), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "")
    .replace(/^export /gm, "");
  vm.runInContext(`(() => { ${source}\n Object.assign(globalThis, { ${exports.join(", ")} }); })()`, context, { filename: file });
}
const settings = { warehouses: [{ key: "main", default: true }], salesPlatforms: [{ key: "web", default: true }] };
const offer = {
  offerNo: "HL-19", currency: "KZT", vatRate: 16,
  buyer: { companyName: "Test buyer" }, seller: { companyName: "Test seller" },
  items: [
    { productId: "p1", sku: "SKU-1", name: "Negotiated product", unit: "шт", quantity: 2, unitPrice: 1160, description: "Agreed specification" },
    { name: "Custom manufacture", unit: "adet", quantity: 1.5, unitPrice: 250 },
  ],
};
const cari = { id: "c1", name: "ERP customer", bin: "123456789012", address: "Test address", active: true };
const args = { offerId: "o1", offerPayload: offer, docType: "R", cariId: "c1", settings };
const count = prefix => [...records.keys()].filter(key => key.startsWith(prefix + "/")).length;

async function main() {
  const build = overrides => context.buildErpSaleFromOffer({ offer, offerId: "o1", docType: "R", cari, products, settings, ...overrides });
  assert.throws(() => build({ docType: "" }), /belge tipini/);
  assert.throws(() => build({ cari: { ...cari, active: false } }), /Pasif/);
  assert.throws(() => build({ offer: { ...offer, currency: "USD" } }), /KZT/);
  for (const items of [[], [{ name: "X", quantity: 0, unitPrice: 1 }], [{ name: "X", quantity: 1, unitPrice: null }], [{ name: "X", quantity: 1, unitPrice: -1 }], [{ name: "", quantity: 1, unitPrice: 1 }]]) {
    assert.throws(() => build({ offer: { ...offer, items } }));
  }
  assert.throws(() => build({ products: [] }), /kataloğunda/);
  assert.throws(() => build({ products: [{ ...products[0], saleEnabled: false }] }), /satışa kapalı/);
  const free = build({ offer: { ...offer, items: [{ name: "Free", quantity: 1, unitPrice: 0 }] } });
  assert.equal(free.items[0].unitPrice, 0);
  const mapped = build();
  assert.equal(mapped.items[0].unitPrice, 1160, "Never use current catalog price");
  assert.equal(mapped.items[0].notes, "Agreed specification");
  assert.equal(mapped.items[1].stockTracked, false, "Manual lines must not create stock entries");
  assert.equal(mapped.items[1].quantity, 1.5);
  assert.ok(build({ docType: "F" }).items.every(item => item.stockSourceType === "F"));

  put("commercial_offers/o1", { ...offer, items: [{ ...offer.items[0], unitPrice: 2000 }] });
  put("erp_caris/c1", cari);
  const result = await context.convertCommercialOfferToSale(args);
  const saleKey = `erp_sales/${result.id}`;
  const sale = records.get(saleKey);
  assert.equal(sale.status, "draft");
  assert.equal(sale.totalAmount, 2695, "Discounted prices and VAT-inclusive total stay unchanged");
  assert.equal(sale.payment.enabled, false);
  assert.equal(sale.documentNo, "");
  assert.equal(sale.invoiceNo, "");
  assert.equal(sale.sourceCommercialOfferNo, "HL-19");
  assert.equal(sale.cariSnapshot.bin, cari.bin);
  assert.equal(sale.sellerSnapshot.companyName, "Test seller");
  assert.equal(records.get("commercial_offers/o1").salesDocumentId, result.id);
  assert.equal(records.get("commercial_offers/o1").items[0].unitPrice, 1160, "Save current offer edits atomically");
  for (const name of ["erp_stock_movements", "erp_stock_balances", "erp_cari_movements", "erp_cash_movements", "erp_document_settlements", "erp_invoice_counters"]) assert.equal(count(name), 0, name);

  await context.saveErpDraftDocument({ kind: "sales", payload: { ...sale, id: result.id }, settings });
  assert.equal(records.get(saleKey).sourceCommercialOfferId, "o1");
  assert.equal(records.get(saleKey).cariSnapshot.bin, cari.bin, "Snapshot survives draft editing");
  put(saleKey, { ...records.get(saleKey), status: "confirmed", totalAmount: 99 });
  const repeat = await context.convertCommercialOfferToSale({ ...args, docType: "F", cariId: "", newCari: { name: "Must not be created" } });
  assert.equal(repeat.id, result.id);
  assert.equal(records.get(saleKey).totalAmount, 99, "Never overwrite the existing invoice");
  assert.equal(count("erp_caris"), 1);

  put("commercial_offers/o2", offer);
  const newArgs = { ...args, offerId: "o2", docType: "F", cariId: "", newCari: { name: "New buyer", bin: "222", contactName: "Contact" } };
  const concurrent = await Promise.all([context.convertCommercialOfferToSale(newArgs), context.convertCommercialOfferToSale(newArgs)]);
  assert.equal(concurrent[0].id, concurrent[1].id);
  assert.ok(retries > 0, "Concurrent conversion exercises transaction retry");
  assert.equal(count("erp_sales"), 2);
  assert.equal(count("erp_caris"), 2, "Concurrent conversion creates one new cari");
  const second = records.get(`erp_sales/${concurrent[0].id}`);
  assert.equal(second.docType, "F");
  assert.ok(second.items.every(item => item.stockSourceType === "F"));
  assert.equal(records.get(`erp_caris/${second.cariId}`).code, "CAR000001");

  put("commercial_offers/o3", offer);
  const before = JSON.stringify([...records]);
  failCommit = true;
  await assert.rejects(context.convertCommercialOfferToSale({ ...newArgs, offerId: "o3" }), /network failure/);
  assert.equal(JSON.stringify([...records]), before, "Failure leaves no partial cari, draft or offer link");
  failCommit = false;
  await context.convertCommercialOfferToSale({ ...newArgs, offerId: "o3" });
  assert.equal(count("erp_sales"), 3);
  assert.equal(count("erp_caris"), 3);

  put("commercial_offers/bad", offer);
  const invalidBefore = JSON.stringify([...records]);
  await assert.rejects(context.convertCommercialOfferToSale({ ...args, offerId: "bad", docType: "" }), /belge tipini/);
  await assert.rejects(context.convertCommercialOfferToSale({ ...args, offerId: "bad", cariId: "missing" }), /carisi bulunamadı/);
  await assert.rejects(context.convertCommercialOfferToSale({ ...newArgs, offerId: "bad", offerPayload: { ...offer, items: [] } }), /en az bir ürün/);
  assert.equal(JSON.stringify([...records]), invalidBefore);
  put("commercial_offers/broken", { ...offer, salesDocumentId: "missing" });
  await assert.rejects(context.convertCommercialOfferToSale({ ...args, offerId: "broken" }), /bağlı satış belgesi bulunamadı/);
  console.log("PASS: offer mapping, R/F choice, price preservation, draft-only effects, links, existing invoice protection, concurrency, atomic failure/retry and validation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
