import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const colors = {
  navy: "#1d3246",
  orange: "#e87524",
  border: "#d9e1e8",
  muted: "#64748b",
  soft: "#f6f8fa",
};

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 38, fontFamily: "NotoSans", color: colors.navy, backgroundColor: "#ffffff" },
  header: { padding: 15, marginBottom: 13, borderRadius: 8, backgroundColor: colors.navy, alignItems: "center" },
  logo: { width: 170, height: 45, objectFit: "contain", marginBottom: 8 },
  contact: { color: "#ffffff", fontSize: 10, marginTop: 2 },
  documentTitle: { marginBottom: 11, textAlign: "center", fontSize: 16, fontWeight: 700, letterSpacing: 1.5 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 2 },
  metaText: { fontSize: 9.5 },
  metaLabel: { fontWeight: 700 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: "hidden" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 86 },
  lastRow: { borderBottomWidth: 0 },
  headerRow: { minHeight: 28, backgroundColor: colors.soft, alignItems: "center" },
  cell: { padding: 7, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: "center" },
  lastCell: { borderRightWidth: 0 },
  photo: { width: "14%", alignItems: "center" },
  details: { width: "35%" },
  quantity: { width: "9%", alignItems: "center" },
  unit: { width: "10%", alignItems: "center" },
  price: { width: "15%", alignItems: "flex-end" },
  total: { width: "17%", alignItems: "flex-end" },
  imageBox: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  image: { width: 68, height: 68, objectFit: "contain" },
  placeholder: { fontSize: 8, color: colors.muted },
  heading: { fontSize: 8.5, fontWeight: 700 },
  name: { fontSize: 11, fontWeight: 700, lineHeight: 1.25 },
  brand: { marginTop: 3, fontSize: 8.5, fontWeight: 700, color: colors.orange },
  description: { marginTop: 5, fontSize: 8.5, lineHeight: 1.35, color: colors.muted },
  body: { fontSize: 9.5 },
  money: { fontSize: 10, fontWeight: 700 },
  summary: { marginTop: 12, marginLeft: "auto", width: 210, borderRadius: 7, backgroundColor: colors.navy, padding: 12 },
  summaryLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "#b8c7d5" },
  summaryValue: { marginTop: 5, fontSize: 15, fontWeight: 700, color: "#ffffff" },
  noteBox: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.soft, padding: 10 },
  noteLabel: { fontSize: 8, fontWeight: 700, color: colors.muted, letterSpacing: 0.8 },
  noteText: { marginTop: 5, fontSize: 9, lineHeight: 1.4, color: colors.navy },
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

function quantity(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "0";
}

function displayDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("tr-TR");
}

export default function ProductPresentationPdf({ presentation, logoUrl, fontUrl }) {
  Font.register({ family: "NotoSans", fonts: [{ src: fontUrl, fontWeight: 400 }, { src: fontUrl, fontWeight: 700 }] });
  const items = Array.isArray(presentation.items) ? presentation.items : [];
  const grandTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);

  return (
    <Document title={presentation.title || "HorecaLink ürün listesi"} author="HorecaLink">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} wrap={false}>
          <Image src={logoUrl} style={styles.logo} alt="HorecaLink" />
          <Text style={styles.contact}>{presentation.contact?.phone || "+7 700 444 69 11"}</Text>
          <Text style={styles.contact}>{presentation.contact?.website || "www.horecalink.kz"}</Text>
        </View>

        <Text style={styles.documentTitle}>СПИСОК ТОВАРОВ</Text>
        <View style={styles.meta} wrap={false}>
          <Text style={styles.metaText}><Text style={styles.metaLabel}>КЛИЕНТ: </Text>{String(presentation.customerName || "-")}</Text>
          <Text style={styles.metaText}><Text style={styles.metaLabel}>ДАТА: </Text>{displayDate(presentation.issueDate)}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            <Cell style={styles.photo}><Text style={styles.heading}>ФОТО</Text></Cell>
            <Cell style={styles.details}><Text style={styles.heading}>ТОВАР</Text></Cell>
            <Cell style={styles.quantity}><Text style={styles.heading}>КОЛ-ВО</Text></Cell>
            <Cell style={styles.unit}><Text style={styles.heading}>ЕД.</Text></Cell>
            <Cell style={styles.price}><Text style={styles.heading}>ЦЕНА</Text></Cell>
            <Cell style={styles.total} last><Text style={styles.heading}>СУММА</Text></Cell>
          </View>
          {items.map((item, index) => (
            <View key={item.rowId || `${index}`} style={[styles.row, index === items.length - 1 && styles.lastRow]} wrap={false}>
              <Cell style={styles.photo}>
                <View style={styles.imageBox}>
                  {item.pdfImageUrl ? <Image src={item.pdfImageUrl} style={styles.image} alt="" /> : <Text style={styles.placeholder}>Нет фото</Text>}
                </View>
              </Cell>
              <Cell style={styles.details}>
                <Text style={styles.name}>{String(item.name || "Ürün")}</Text>
                {item.brand ? <Text style={styles.brand}>{String(item.brand)}</Text> : null}
                {item.description ? <Text style={styles.description}>{String(item.description)}</Text> : null}
              </Cell>
              <Cell style={styles.quantity}><Text style={styles.body}>{quantity(item.quantity)}</Text></Cell>
              <Cell style={styles.unit}><Text style={styles.body}>{String(item.unit || "-")}</Text></Cell>
              <Cell style={styles.price}><Text style={styles.body}>{money(item.unitPrice, presentation.currency)}</Text></Cell>
              <Cell style={styles.total} last><Text style={styles.money}>{money(Number(item.quantity || 0) * Number(item.unitPrice || 0), presentation.currency)}</Text></Cell>
            </View>
          ))}
        </View>

        <View style={styles.summary} wrap={false}>
          <Text style={styles.summaryLabel}>ИТОГО</Text>
          <Text style={styles.summaryValue}>{money(grandTotal, presentation.currency)}</Text>
        </View>

        {presentation.note ? (
          <View style={styles.noteBox} wrap={false}>
            <Text style={styles.noteLabel}>ПРИМЕЧАНИЕ</Text>
            <Text style={styles.noteText}>{String(presentation.note)}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>HorecaLink</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
