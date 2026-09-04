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

export default function ErpSalesPdf({ record, seller = {}, fontUrl }) {
  Font.register({ family: "InvoiceNoto", src: fontUrl });
  const number = text(record.invoiceNo || record.documentNo || record.draftNo || record.id);
  const official = record.docType !== "F";
  const buyer = record.cariSnapshot || {};
  const status = record.status === "confirmed" ? "Onaylı" : record.status === "cancelled" ? "İPTAL" : "TASLAK";
  const items = Array.isArray(record.items) ? record.items : [];
  return h(Document, { title: `Satış faturası ${number}`, author: "HorecaLink" },
    h(Page, { size: "A4", style: s.page, wrap: true },
      h(View, { style: s.block },
        h(Text, { style: s.brand }, "HorecaLink"),
        h(Text, { style: s.title }, "SATIŞ FATURASI"),
        line(`No: ${number}`),
        line(`Tarih: ${record.dateLabel || record.documentDate || "-"}`),
        line(`${official ? "Resmî belge (R)" : "Fiili belge (F)"}  |  ${status}`),
      ),
      h(View, { style: s.block },
        line(`Satıcı: ${text(seller.companyName) || "HorecaLink"}`),
        seller.bin ? line(`BIN: ${seller.bin}`) : null,
        seller.address ? line(seller.address) : null,
      ),
      h(View, { style: s.block },
        line(`Alıcı: ${text(record.cariName || buyer.name || buyer.companyName) || "-"}`),
        buyer.bin ? line(`BIN/IIN: ${buyer.bin}`) : null,
        buyer.legalAddress || buyer.address ? line(buyer.legalAddress || buyer.address) : null,
      ),
      h(View, { style: s.header, fixed: true }, cell("Ürün / Kod", "44%"), cell("Miktar", "12%", true), cell("Birim", "10%"), cell("Birim fiyat", "17%", true), cell("Tutar", "17%", true)),
      ...items.map((item, index) => h(View, { style: s.row, key: index, wrap: false },
        cell([text(item.productName) || "Ürün", text(item.productSku)].filter(Boolean).join("\n"), "44%"),
        cell(money(item.quantity), "12%", true), cell(text(item.unit), "10%"),
        cell(money(item.unitPrice), "17%", true), cell(money(item.lineTotal ?? Number(item.quantity) * Number(item.unitPrice)), "17%", true),
      )),
      h(View, { style: s.totals, wrap: false },
        line("Para birimi: KZT"),
        h(Text, { style: s.total }, `Genel toplam: ${money(record.totalAmount)} KZT`),
        official ? h(Text, { style: [s.muted, { marginTop: 8 }] }, "Bu kayıtta KDV dahil/hariç bilgisi ve KDV dökümü bulunmuyor. Kayıtlı toplam değiştirilmeden gösterilmiştir.") : null,
      ),
      record.notes ? h(View, { style: [s.block, { marginTop: 16 }] }, line("Notlar"), line(text(record.notes))) : null,
      seller.bankDetails ? h(View, { style: [s.block, { marginTop: 16 }] }, line("Banka bilgileri"), line(text(seller.bankDetails))) : null,
      h(Text, { style: s.footer, fixed: true, render: ({ pageNumber, totalPages }) => `${number}  |  ${pageNumber} / ${totalPages}` }),
    ));
}
