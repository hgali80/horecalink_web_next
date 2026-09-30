import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import ProductListPdf from "./ProductListPdf";

self.onmessage = async ({ data }) => {
  try {
    const blob = await pdf(createElement(ProductListPdf, data)).toBlob();
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error?.message || "PDF oluşturulamadı." });
  }
};
