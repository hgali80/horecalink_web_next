"use client";

import { Suspense, useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const MEASUREMENT_ID = "G-2T67D7EE7S";

function PageViewTracker({ ready }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || typeof window.gtag !== "function") return;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
    });
  }, [pathname, ready]);

  return null;
}

export default function GoogleAnalytics() {
  const [ready, setReady] = useState(false);

  return (
    <>
      <Script id="google-analytics-init" strategy="afterInteractive" onReady={() => setReady(true)}>
        {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
if (!window.__horecalinkGa4Initialized) {
  window.__horecalinkGa4Initialized = true;
  window.gtag('js', new Date());
  window.gtag('config', '${MEASUREMENT_ID}', { send_page_view: false });
}`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <PageViewTracker ready={ready} />
      </Suspense>
    </>
  );
}
