import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getProductPresentationExportLabel } from "@/app/lib/productPresentationExportLabels";
import { getAdjustedPresentationPrice, getPresentationPriceColumns } from "@/app/satissitok/services/productPresentationService";

const colors = {
  navy: "#1d3246",
  orange: "#e87524",
  border: "#d9e1e8",
  muted: "#64748b",
  soft: "#f6f8fa",
};

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 38, fontFamily: "NotoSans", color: colors.navy, backgroundColor: "#ffffff" },
  header: { paddingTop: 8, paddingBottom: 9, paddingLeft: 18, paddingRight: 18, marginBottom: 14, borderRadius: 8, backgroundColor: colors.navy, alignItems: "center" },
  logo: { width: 260, height: 39, objectFit: "contain", marginBottom: 3 },
  contact: { color: "#ffffff", fontSize: 9, marginTop: 0 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 86 },
  lastRow: { borderBottomWidth: 0 },
  headerRow: { minHeight: 28, backgroundColor: colors.soft, alignItems: "center" },
  cell: { padding: 7, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: "center" },
  lastCell: { borderRightWidth: 0 },
  photo: { width: "18%", alignItems: "center" },
  details: { width: "47%" },
  unit: { width: "13%", alignItems: "center" },
  price: { width: "22%", alignItems: "flex-end" },
  secondaryPrice: { width: "17%", alignItems: "flex-end" },
  imageBox: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  image: { width: 68, height: 68, objectFit: "contain" },
  placeholder: { fontSize: 8, color: colors.muted },
  heading: { fontSize: 8.5, fontWeight: 700 },
  name: { fontSize: 11, fontWeight: 700, lineHeight: 1.25 },
  brand: { marginTop: 3, fontSize: 8.5, fontWeight: 700, color: colors.orange },
  description: { marginTop: 5, fontSize: 8.5, lineHeight: 1.35, color: colors.muted },
  body: { fontSize: 9.5 },
  money: { fontSize: 10, fontWeight: 700 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: colors.muted },
});

function money(value, currency) {
  const amount = Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbols = { KZT: "₸", TRY: "TL", USD: "$", EUR: "€" };
  return `${amount} ${symbols[currency] || currency || "KZT"}`;
}

function Cell({ style, last = false, children }) {
  return <View style={[styles.cell, style, last && styles.lastCell]}>{children}</View>;
}

export default function ProductPresentationPdf({ presentation, logoUrl, fontUrl, language = "tr" }) {
  Font.register({ family: "NotoSans", fonts: [{ src: fontUrl, fontWeight: 400 }, { src: fontUrl, fontWeight: 700 }] });
  const label = (key) => getProductPresentationExportLabel(language, key);
  const items = Array.isArray(presentation.items) ? presentation.items : [];
  const priceColumns = getPresentationPriceColumns(presentation);
  const hasBothPrices = priceColumns.base && priceColumns.adjusted;
  const photoStyle = hasBothPrices ? { ...styles.photo, width: "16%" } : styles.photo;
  const detailsStyle = hasBothPrices ? { ...styles.details, width: "38%" } : styles.details;
  const unitStyle = hasBothPrices ? { ...styles.unit, width: "12%" } : styles.unit;

  return (
    <Document title={label("presentation")} author="HorecaLink">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} wrap={false}>
          <Image src={logoUrl} style={styles.logo} alt="HorecaLink" />
          <Text style={styles.contact}>
            {presentation.contact?.phone || "+7 700 444 69 11"}
            {presentation.visibility?.showWebsite !== false ? `   ·   ${presentation.contact?.website || "www.horecalink.kz"}` : ""}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            <Cell style={photoStyle}><Text style={styles.heading}>{label("photoHeader")}</Text></Cell>
            <Cell style={detailsStyle}><Text style={styles.heading}>{label("productHeader")}</Text></Cell>
            <Cell style={unitStyle}><Text style={styles.heading}>{label("unitHeader")}</Text></Cell>
            {priceColumns.base ? <Cell style={hasBothPrices ? styles.secondaryPrice : styles.price} last={!priceColumns.adjusted}><Text style={styles.heading}>{label("basePriceHeader")}</Text></Cell> : null}
            {priceColumns.adjusted ? <Cell style={hasBothPrices ? styles.secondaryPrice : styles.price} last><Text style={styles.heading}>{label("newPriceHeader")}</Text></Cell> : null}
          </View>
          {items.map((item, index) => (
            <View key={item.rowId || `${index}`} style={[styles.row, index === items.length - 1 && styles.lastRow]} wrap={false}>
              <Cell style={photoStyle}>
                <View style={styles.imageBox}>
                  {item.pdfImageUrl ? <Image src={item.pdfImageUrl} style={styles.image} alt="" /> : <Text style={styles.placeholder}>{label("imageUnavailable")}</Text>}
                </View>
              </Cell>
              <Cell style={detailsStyle}>
                <Text style={styles.name}>{String(item.name || "Ürün")}</Text>
                {item.brand ? <Text style={styles.brand}>{String(item.brand)}</Text> : null}
                {item.description ? <Text style={styles.description}>{String(item.description)}</Text> : null}
              </Cell>
              <Cell style={unitStyle}><Text style={styles.body}>{String(item.unit || "-")}</Text></Cell>
              {priceColumns.base ? <Cell style={hasBothPrices ? styles.secondaryPrice : styles.price} last={!priceColumns.adjusted}><Text style={styles.money}>{money(item.unitPrice, presentation.currency)}</Text></Cell> : null}
              {priceColumns.adjusted ? <Cell style={hasBothPrices ? styles.secondaryPrice : styles.price} last><Text style={styles.money}>{money(getAdjustedPresentationPrice(item), presentation.currency)}</Text></Cell> : null}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>HorecaLink</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${label("page")} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
