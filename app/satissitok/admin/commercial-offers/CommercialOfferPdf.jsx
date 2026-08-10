import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const colors = {
  accent: "#F6A400",
  primary: "#22364D",
  primarySoft: "#24384D",
  border: "#D7DEE6",
  muted: "#64748B",
  panel: "#EEF2F5",
  panelSoft: "#F8FAFC",
  textDark: "#2F3337",
  placeholder: "#94A3B8",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingRight: 28,
    paddingBottom: 40,
    paddingLeft: 28,
    fontFamily: "NotoSans",
    fontSize: 10,
    color: "#000000",
  },
  topBar: { height: 16, marginLeft: 18, marginRight: 18, marginBottom: 18, flexDirection: "row" },
  topBarAccent: { width: "16%", backgroundColor: colors.accent },
  topBarMain: { width: "84%", backgroundColor: colors.primarySoft },
  header: { flexDirection: "row", alignItems: "flex-start" },
  brand: { flexGrow: 1, flexBasis: 0 },
  logo: { width: 240, height: 88, objectFit: "contain", objectPosition: "left center" },
  brandName: { marginTop: 6, fontSize: 22, fontWeight: 700, color: colors.primary },
  tagline: { marginTop: 6, maxWidth: 280, fontSize: 13, color: colors.muted },
  website: { marginTop: 8, fontSize: 11, fontWeight: 700, color: colors.primary },
  metaBox: { width: 250, marginLeft: 18, borderWidth: 1.5, borderColor: colors.muted },
  metaTitle: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.panel, fontSize: 13, fontWeight: 700, color: colors.textDark },
  metaBody: { padding: 14, alignItems: "flex-end" },
  metaNo: { fontSize: 16, fontWeight: 700 },
  metaLine: { marginTop: 10, fontSize: 12 },
  titleBlock: { marginTop: 18, alignItems: "center" },
  title: { fontSize: 18, fontWeight: 700, color: colors.primary, textAlign: "center" },
  titleLine: { marginTop: 4, fontSize: 16, fontWeight: 700, color: colors.primary, textAlign: "center" },
  parties: { marginTop: 16, flexDirection: "row", borderWidth: 1, borderColor: colors.border },
  party: { width: "50%", padding: 12 },
  partyLeft: { borderRightWidth: 1, borderRightColor: colors.border },
  partyRole: { marginBottom: 4, fontSize: 14 },
  bodyText: { fontSize: 10 },
  intro: { marginTop: 14 },
  introGreeting: { fontSize: 11 },
  introText: { marginTop: 2, fontSize: 11 },
  table: { marginTop: 14 },
  row: { flexDirection: "row", borderLeftWidth: 0.8, borderRightWidth: 0.8, borderBottomWidth: 0.8, borderColor: colors.border },
  headerRow: { backgroundColor: colors.primary, borderTopWidth: 0.8 },
  cell: { padding: 6, justifyContent: "center", borderRightWidth: 0.8, borderRightColor: colors.border },
  lastCell: { borderRightWidth: 0 },
  headerCell: { paddingHorizontal: 4, paddingVertical: 8, color: "#FFFFFF", fontSize: 10, fontWeight: 700, textAlign: "center" },
  colNo: { width: 24 },
  colPhoto: { width: 94 },
  colDetails: { flexGrow: 1, flexBasis: 0 },
  colQty: { width: 48 },
  colPrice: { width: 72 },
  colTotal: { width: 84 },
  bodyCell: { fontSize: 10 },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  productImageBox: { height: 68, alignItems: "center", justifyContent: "center" },
  productImage: { width: 82, height: 62, objectFit: "contain" },
  imagePlaceholder: { width: 82, height: 62, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft },
  placeholderText: { fontSize: 8, color: colors.placeholder },
  productName: { fontSize: 12, fontWeight: 700, color: colors.primary },
  sku: { marginTop: 4, marginBottom: 4, fontSize: 9, color: colors.muted },
  description: { fontSize: 9.5 },
  missingDescription: { fontSize: 9.5, color: colors.muted },
  totals: { width: 300, marginTop: 14, marginLeft: "auto", alignItems: "stretch" },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalText: { fontSize: 16, fontWeight: 700 },
  vatText: { marginTop: 4, fontSize: 11, textAlign: "right" },
  terms: { marginTop: 18, flexDirection: "row", borderWidth: 1, borderColor: colors.border },
  termColumn: { width: "33.333%" },
  termBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  termTitle: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.panelSoft, fontSize: 13, fontWeight: 700, color: colors.primary },
  termBody: { padding: 10 },
  termLine: { marginBottom: 4, fontSize: 10 },
  bank: { marginTop: 16, fontSize: 10.5, color: colors.muted },
  signature: { marginTop: 22, flexDirection: "row", alignItems: "flex-end" },
  signatureLeft: { flexGrow: 1, flexBasis: 0 },
  signatureText: { fontSize: 11, color: colors.muted },
  signatureLine: { fontSize: 11 },
  footer: { position: "absolute", left: 28, right: 28, bottom: 24, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 9, color: colors.muted },
});

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  return `${number(value).toLocaleString("ru-RU")} ₸`;
}

function formatQuantity(value) {
  const amount = number(value);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function formatDate(value) {
  const raw = String(value || "").trim();
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(raw);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(safeDate);
}

function placeholder(value) {
  const result = String(value ?? "").trim();
  return result || "________________";
}

function TableCell({ style, last = false, children }) {
  return <View style={[styles.cell, style, last && styles.lastCell]}>{children}</View>;
}

function ItemsTable({ items }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]} wrap={false}>
        <TableCell style={styles.colNo}><Text style={styles.headerCell}>№</Text></TableCell>
        <TableCell style={styles.colPhoto}><Text style={styles.headerCell}>Фото</Text></TableCell>
        <TableCell style={styles.colDetails}><Text style={styles.headerCell}>Характеристики</Text></TableCell>
        <TableCell style={styles.colQty}><Text style={styles.headerCell}>Кол-во</Text></TableCell>
        <TableCell style={styles.colPrice}><Text style={styles.headerCell}>Цена</Text></TableCell>
        <TableCell style={styles.colTotal} last><Text style={styles.headerCell}>Сумма</Text></TableCell>
      </View>
      {items.map((item, index) => {
        const description = String(item.description || item.specs || item.technicalDetails || "").trim();
        const imageUrl = String(item.pdfImageUrl || item.imageUrl || "").trim();
        return (
          <View key={item.rowId || item.productId || `${index}`} style={styles.row} wrap={false}>
            <TableCell style={styles.colNo}><Text style={[styles.bodyCell, styles.center]}>{index + 1}</Text></TableCell>
            <TableCell style={styles.colPhoto}>
              <View style={styles.productImageBox}>
                {imageUrl ? <Image src={imageUrl} style={styles.productImage} alt="" /> : (
                  <View style={styles.imagePlaceholder}><Text style={styles.placeholderText}>No image</Text></View>
                )}
              </View>
            </TableCell>
            <TableCell style={styles.colDetails}>
              <Text style={styles.productName}>{String(item.name || "")}</Text>
              {item.sku ? <Text style={styles.sku}>{String(item.sku)}</Text> : null}
              <Text style={description ? styles.description : styles.missingDescription}>
                {description || "Технические данные не указаны"}
              </Text>
            </TableCell>
            <TableCell style={styles.colQty}><Text style={[styles.bodyCell, styles.center]}>{formatQuantity(item.quantity)} {String(item.unit || "adet")}</Text></TableCell>
            <TableCell style={styles.colPrice}><Text style={[styles.bodyCell, styles.right]}>{formatMoney(item.unitPrice)}</Text></TableCell>
            <TableCell style={styles.colTotal} last><Text style={[styles.bodyCell, styles.right, { fontWeight: 700 }]}>{formatMoney(item.lineTotal)}</Text></TableCell>
          </View>
        );
      })}
    </View>
  );
}

function TermsColumn({ title, lines, bordered }) {
  return (
    <View style={[styles.termColumn, bordered && styles.termBorder]}>
      <Text style={styles.termTitle}>{title}</Text>
      <View style={styles.termBody}>
        {(Array.isArray(lines) ? lines : []).map((line, index) => <Text key={`${index}-${line}`} style={styles.termLine}>- {line}</Text>)}
      </View>
    </View>
  );
}

export default function CommercialOfferPdf({ offer, totals, typeConfig, logoUrl, fontUrl }) {
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: fontUrl, fontWeight: 400 },
      { src: fontUrl, fontWeight: 700 },
    ],
  });

  const seller = offer.seller || {};
  const buyer = offer.buyer || {};
  const visibility = offer.visibility || {};
  const terms = offer.terms || {};
  const items = Array.isArray(offer.items) ? offer.items : [];

  return (
    <Document title={offer.offerNo || "HorecaLink"} author="HorecaLink">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.topBar} wrap={false}><View style={styles.topBarAccent} /><View style={styles.topBarMain} /></View>
        <View style={styles.header} wrap={false}>
          <View style={styles.brand}>
            <Image src={logoUrl} style={styles.logo} alt="HorecaLink" />
            <Text style={styles.brandName}>{seller.brandName || "HorecaLink"}</Text>
            <Text style={styles.tagline}>{seller.tagline || ""}</Text>
            <Text style={styles.website}>www.horecalink.kz</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaTitle}>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</Text>
            <View style={styles.metaBody}>
              <Text style={styles.metaNo}>№ {offer.offerNo || ""}</Text>
              <Text style={styles.metaLine}>от {formatDate(offer.issueDate)} г.</Text>
              <Text style={styles.metaLine}>Срок действия: {offer.validDays} календарных дней</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleBlock} wrap={false}>
          <Text style={styles.title}>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</Text>
          <Text style={styles.titleLine}>{typeConfig.titleLine}</Text>
        </View>

        <View style={styles.parties} wrap={false}>
          <View style={[styles.party, styles.partyLeft]}>
            <Text style={styles.partyRole}>{typeConfig.sellerRole}</Text>
            <Text style={styles.bodyText}>{seller.brandName || ""}</Text>
            <Text style={styles.bodyText}>{typeConfig.sellerCaption}</Text>
            <Text style={styles.bodyText}>{seller.companyName || ""}</Text>
            <Text style={styles.bodyText}>БИН: {seller.bin || ""}</Text>
            <Text style={styles.bodyText}>{seller.address || ""}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyRole}>Покупатель:</Text>
            <Text style={styles.bodyText}>{placeholder(buyer.companyName)}</Text>
            <Text style={styles.bodyText}>БИН/ИИН: {placeholder(buyer.bin)}</Text>
            <Text style={styles.bodyText}>{placeholder(buyer.address)}</Text>
          </View>
        </View>

        <View style={styles.intro} wrap={false}>
          <Text style={styles.introGreeting}>Добрый день,</Text>
          <Text style={styles.introText}>{offer.introText || ""}</Text>
        </View>

        <ItemsTable items={items} />

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}><Text style={styles.totalText}>Итого:</Text><Text style={styles.totalText}>{formatMoney(totals.grandTotal)}</Text></View>
          {visibility.vatSummary !== false ? <Text style={styles.vatText}>В том числе НДС {offer.vatRate}%: {formatMoney(totals.vatAmount)}</Text> : null}
        </View>

        {visibility.termsSection !== false ? (
          <View style={styles.terms} wrap={false}>
            <TermsColumn title="Условия поставки" lines={terms.delivery} bordered />
            <TermsColumn title="Условия оплаты" lines={terms.payment} bordered />
            <TermsColumn title="Гарантия" lines={terms.warranty} />
          </View>
        ) : null}

        {visibility.requisitesSection !== false ? (
          <Text style={styles.bank}>{seller.bankDetails || ""}</Text>
        ) : null}
        <View style={styles.signature} wrap={false}>
          <View style={styles.signatureLeft}>
            <Text style={styles.signatureText}>С уважением,</Text>
            <Text style={styles.signatureText}>{seller.signatureName || ""}</Text>
            <Text style={styles.signatureText}>{seller.signatureSubtitle || ""}</Text>
          </View>
          <Text style={styles.signatureLine}>Подпись: _______________________</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>HorecaLink - коммерческое предложение</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `стр. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
