"use client";

import ErpDocumentEditor from "../../_components/ErpDocumentEditor";

export default function EditErpSalePage({ params }) {
  return <ErpDocumentEditor kind="sales" documentId={params.documentId} />;
}
