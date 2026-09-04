import { createElement as h } from "react";
import { Document, Font, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { fontFamily: "InvoiceNoto", fontSize: 9, padding: 36, paddingBottom: 54, color: "#243447" },
  brand: { fontSize: 23, fontWeight: 700, color: "#163c51", marginBottom: 5 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  line: { marginBottom: 4 },
  block: { marginBottom: 16 },
  muted: { color: "#64748b", fontSize: 8, marginBottom: 5 },
  header: { flexDirection: "row", backgroundColor: "#e8eef3", paddingVertical: 8, fontWeight: 700 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dbe3eb", paddingVertical: 8 },
  cell: { paddingHorizontal: 5 },
  totals: { marginTop: 16, padding: 12, backgroundColor: "#f1f5f9" },
  total: { fontSize: 12, fontWeight: 700, marginTop: 5 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#64748b", textAlign: "right" },
});

const text = (value) => String(value ?? "").trim();
const money = (value) => Number(value ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const line = (value, key) => h(Text, { style: s.line, key }, value);
const cell = (value, width, right = false) => h(Text, { style: [s.cell, { width, textAlign: right ? "right" : "left" }] }, value);

const COPY = {
  ru: {
    saleTitle: "СЧЕТ-ФАКТУРА",
    dispatchTitle: "НАКЛАДНАЯ НА ОТПУСК ТОВАРА",
    date: "Дата",
    official: "Официальный документ (R)",
    actual: "Фактический документ (F)",
    confirmed: "Подтверждено",
    cancelled: "АННУЛИРОВАНО",
    draft: "ЧЕРНОВИК",
    seller: "Продавец",
    buyer: "Покупатель",
    item: "Товар / Код",
    quantity: "Кол-во",
    unit: "Ед.",
    unitPrice: "Цена",
    amount: "Сумма",
    currency: "Валюта",
    total: "Итого",
    notes: "Примечание",
    bank: "Банковские реквизиты",
    missingVat: "В этой записи отсутствуют данные о включении НДС и его расчете. Сохраненная итоговая сумма не изменена.",
    product: "Товар",
  },
  kz: {
    saleTitle: "ШОТ-ФАКТУРА",
    dispatchTitle: "ТАУАРДЫ БОСАТУ ЖҮКҚҰЖАТЫ",
    date: "Күні",
    official: "Ресми құжат (R)",
    actual: "Нақты құжат (F)",
    confirmed: "Расталды",
    cancelled: "КҮШІ ЖОЙЫЛДЫ",
    draft: "ЖОБА",
    seller: "Сатушы",
    buyer: "Сатып алушы",
    item: "Тауар / Код",
    quantity: "Саны",
    unit: "Өлшем",
    unitPrice: "Бағасы",
    amount: "Сомасы",
    currency: "Валюта",
    total: "Жалпы сома",
    notes: "Ескертпе",
    bank: "Банк деректемелері",
    missingVat: "Бұл жазбада ҚҚС-тың бағаға қосылғаны және ҚҚС есебі көрсетілмеген. Сақталған жалпы сома өзгертілмеді.",
    product: "Тауар",
  },
};

export default function ErpSalesPdf({ record, seller = {}, fontUrl, language = "ru" }) {
  Font.register({ family: "InvoiceNoto", src: fontUrl });
  const t = COPY[language] || COPY.ru;
  const number = text(record.invoiceNo || record.documentNo || record.draftNo || record.id);
  const official = record.docType !== "F";
  const buyer = record.cariSnapshot || {};
  const status = record.status === "confirmed" ? t.confirmed : record.status === "cancelled" ? t.cancelled : t.draft;
  const items = Array.isArray(record.items) ? record.items : [];
  return h(Document, { title: `${official ? t.saleTitle : t.dispatchTitle} ${number}`, author: "HorecaLink" },
    h(Page, { size: "A4", style: s.page, wrap: true },
      h(View, { style: s.block },
        h(Text, { style: s.brand }, "HorecaLink"),
        h(Text, { style: s.title }, official ? t.saleTitle : t.dispatchTitle),
        line(`№: ${number}`),
        line(`${t.date}: ${record.dateLabel || record.documentDate || "-"}`),
        official ? line(`${t.official}  |  ${status}`) : null,
      ),
      official ? h(View, { style: s.block },
        line(`${t.seller}: ${text(seller.companyName) || "HorecaLink"}`),
        seller.bin ? line(`BIN: ${seller.bin}`) : null,
        seller.address ? line(seller.address) : null,
      ) : null,
      h(View, { style: s.block },
        line(`${t.buyer}: ${text(record.cariName || buyer.name || buyer.companyName) || "-"}`),
        official && buyer.bin ? line(`BIN/IIN: ${buyer.bin}`) : null,
        official && (buyer.legalAddress || buyer.address) ? line(buyer.legalAddress || buyer.address) : null,
      ),
      h(View, { style: s.header, fixed: true }, cell(t.item, "44%"), cell(t.quantity, "12%", true), cell(t.unit, "10%"), cell(t.unitPrice, "17%", true), cell(t.amount, "17%", true)),
      ...items.map((item, index) => h(View, { style: s.row, key: index, wrap: false },
        cell([text(item.productName) || t.product, text(item.productSku)].filter(Boolean).join("\n"), "44%"),
        cell(money(item.quantity), "12%", true), cell(text(item.unit), "10%"),
        cell(money(item.unitPrice), "17%", true), cell(money(item.lineTotal ?? Number(item.quantity) * Number(item.unitPrice)), "17%", true),
      )),
      h(View, { style: s.totals, wrap: false },
        line(`${t.currency}: KZT`),
        h(Text, { style: s.total }, `${t.total}: ${money(record.totalAmount)} KZT`),
        official ? h(Text, { style: [s.muted, { marginTop: 8 }] }, t.missingVat) : null,
      ),
      record.notes ? h(View, { style: [s.block, { marginTop: 16 }] }, line(t.notes), line(text(record.notes))) : null,
      official && seller.bankDetails ? h(View, { style: [s.block, { marginTop: 16 }] }, line(t.bank), line(text(seller.bankDetails))) : null,
      h(Text, { style: s.footer, fixed: true, render: ({ pageNumber, totalPages }) => `${number}  |  ${pageNumber} / ${totalPages}` }),
    ));
}
