"use client";

import ErpCashAccountEditor from "../../../_components/ErpCashAccountEditor";

export default function EditErpCashAccountPage({ params }) {
  return <ErpCashAccountEditor accountId={params.accountId} />;
}
