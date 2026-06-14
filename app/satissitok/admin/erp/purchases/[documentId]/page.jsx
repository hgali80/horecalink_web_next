"use client";

import ErpDocumentEditor from "../../_components/ErpDocumentEditor";

export default function EditErpPurchasePage({ params }) {
  return <ErpDocumentEditor kind="purchases" documentId={params.documentId} />;
}
