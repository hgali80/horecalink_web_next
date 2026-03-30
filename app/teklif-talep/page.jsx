//app/teklif-talep/page.jsx

import { Suspense } from "react";
import QuoteRequestClient from "./QuoteRequestClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <QuoteRequestClient />
    </Suspense>
  );
}