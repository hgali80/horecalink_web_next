"use client";

import ErpCariEditor from "../../../_components/ErpCariEditor";

export default function EditErpCariPage({ params }) {
  return <ErpCariEditor cariId={params.cariId} />;
}
