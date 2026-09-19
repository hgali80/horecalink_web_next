import ExcelJS from "exceljs";

const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value) => String(value ?? "");
const navy = "FF1D3246";
const border = { style: "thin", color: { argb: "FFD9E1E8" } };

// The offer editor supplies the same normalized items/totals used by its PDF.
export function buildCustomerWorkbook({ document, calculated, t }) {
  const offer = Boolean(calculated);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HorecaLink";
  workbook.calcProperties.fullCalcOnLoad = true;
  const label = (key) => t(`customerExcel.${key}`);
  const sheet = workbook.addWorksheet(label(offer ? "offer" : "presentation"), {
    pageSetup: {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
    },
    headerFooter: { oddFooter: "&LHorecaLink&R&P / &N" },
  });
  const fields = offer
    ? ["sku", "name", "description", "brand", "quantity", "unit", "unitPrice", "total", "image"]
    : ["sku", "name", "description", "brand", "unit", "unitPrice", "image"];
  const widths = { sku: 20, name: 32, description: 44, brand: 17, quantity: 12, unit: 13, unitPrice: 20, total: 20, image: 13 };
  sheet.columns = fields.map((key) => ({ key, width: widths[key] }));
  const currency = document.currency || "KZT";
  const symbol = { KZT: "₸", TRY: "TL", USD: "$", EUR: "€" }[currency] || currency.replace(/[^A-Za-z]/g, "");
  const moneyFormat = `#,##0.00 "${symbol}";[Red]-#,##0.00 "${symbol}"`;

  function addMeta(key, value) {
    if (value === undefined || value === null || value === "") return null;
    const row = sheet.addRow([label(key), value]);
    row.getCell(1).font = { name: "Calibri", size: 11, bold: true, color: { argb: navy } };
    return row;
  }
  sheet.addRow(["HorecaLink", label(offer ? "offer" : "presentation")]);
  // Presentation titles are internal admin labels, never customer-facing content.
  addMeta("offerNo", document.offerNo);
  if (document.issueDate) {
    const raw = text(document.issueDate);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
    const row = addMeta("date", date && !Number.isNaN(date.getTime()) ? date : raw);
    row.getCell(2).numFmt = "dd.mm.yyyy";
  }
  addMeta("validDays", document.validDays);
  addMeta("currency", currency);
  for (const [prefix, party] of [["seller", document.seller], ["buyer", document.buyer]]) {
    for (const key of ["companyName", "bin", "contactName", "phone", "email", "address"]) {
      addMeta(`${prefix}.${key}`, party?.[key]);
    }
  }
  addMeta("phone", document.contact?.phone);
  addMeta("website", document.contact?.website);
  addMeta("intro", document.introText);
  sheet.addRow([]);
  const header = sheet.addRow(fields.map(label));
  const first = header.number + 1;
  const items = offer ? calculated.items : (document.items || []);
  for (const item of items) {
    const values = {
      sku: text(item.sku || item.stock_code), name: text(item.name),
      description: text(item.description || item.specs || item.technicalDetails),
      brand: text(item.brand), unit: text(item.unit),
      unitPrice: numeric(item.unitPrice), quantity: numeric(item.quantity),
    };
    const row = sheet.addRow(values);
    row.getCell("unitPrice").numFmt = moneyFormat;
    if (offer) {
      row.getCell("quantity").numFmt = "0.####";
      row.getCell("total").value = { formula: `E${row.number}*G${row.number}`, result: item.lineTotal };
      row.getCell("total").numFmt = moneyFormat;
    }
    // Keep the original photo accessible without network requests during export.
    if (/^https?:\/\//i.test(text(item.imageUrl))) {
      row.getCell("image").value = { text: label("image"), hyperlink: item.imageUrl };
      row.getCell("image").font = { name: "Calibri", size: 11, color: { argb: "FF2563EB" }, underline: true };
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: border, bottom: border, left: border, right: border };
      if ((row.number - first) % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F8FA" } };
    });
  }
  const last = sheet.rowCount;
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: Math.max(header.number, last), column: fields.length } };
  if (offer) {
    sheet.addRow([]);
    const totalRow = sheet.addRow({ description: label("grandTotal") });
    totalRow.getCell("total").value = { formula: items.length ? `SUM(H${first}:H${last})` : "0", result: calculated.totals.grandTotal };
    const rateRow = sheet.addRow({ description: label("vatRate"), total: calculated.totals.vatRate / 100 });
    rateRow.getCell("total").numFmt = "0.##%";
    const vatRow = sheet.addRow({ description: label("vatIncluded") });
    vatRow.getCell("total").value = {
      formula: `IF(H${rateRow.number}>0,H${totalRow.number}-H${totalRow.number}/(1+H${rateRow.number}),0)`,
      result: calculated.totals.vatAmount,
    };
    const subtotalRow = sheet.addRow({ description: label("subtotal") });
    subtotalRow.getCell("total").value = { formula: `H${totalRow.number}-H${vatRow.number}`, result: calculated.totals.grandTotal - calculated.totals.vatAmount };
    for (const row of [totalRow, vatRow, subtotalRow]) {
      row.getCell("total").numFmt = moneyFormat;
      row.eachCell((cell) => { cell.font = { name: "Calibri", size: 11, bold: true }; cell.border = { bottom: border }; });
    }
    if (document.visibility?.vatSummary === false) {
      rateRow.hidden = true;
      vatRow.hidden = true;
      subtotalRow.hidden = true;
    }
    sheet.addRow([]);
    addMeta("priceNote", document.priceNote);
    if (document.visibility?.termsSection !== false) {
      for (const key of ["delivery", "payment", "warranty"]) {
        for (const line of document.terms?.[key] || []) addMeta(key, text(line));
      }
    }
    if (document.visibility?.requisitesSection !== false) addMeta("bankDetails", document.seller?.bankDetails);
    addMeta("signature", document.seller?.signatureName);
    addMeta("signatureSubtitle", document.seller?.signatureSubtitle);
  }
  sheet.eachRow((row) => {
    let lines = 1;
    row.eachCell((cell, column) => {
      cell.font = { name: "Calibri", size: 11, ...cell.font };
      cell.alignment = { vertical: "top", wrapText: true, horizontal: cell.type === ExcelJS.ValueType.Number || cell.type === ExcelJS.ValueType.Formula ? "right" : "left" };
      const capacity = Math.max(8, (sheet.getColumn(column).width - 2) * 0.85);
      const content = typeof cell.value === "object" ? cell.text : text(cell.value);
      lines = Math.max(lines, content.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / capacity)), 0));
    });
    row.height = Math.min(409, Math.max(27, lines * 16 + 10));
  });
  for (const row of [sheet.getRow(1), header]) {
    for (let column = 1; column <= fields.length; column++) {
      const cell = row.getCell(column);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    row.height = Math.max(36, row.height);
  }
  // Long customer/terms text can make metadata taller than the screen.
  // Freeze the brand row and SKU column, leaving the entire document scrollable.
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2", showGridLines: false }];
  sheet.pageSetup.printTitlesRow = `${header.number}:${header.number}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(fields.length).letter}${sheet.rowCount}`;
  return workbook;
}

export async function downloadCustomerExcel(options) {
  const workbook = buildCustomerWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    const filename = text(options.document.offerNo || "HorecaLink");
    const safeFilename = Array.from(filename, (char) => char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? "-" : char).join("");
    link.download = `${safeFilename.slice(0, 150)}.xlsx`;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
