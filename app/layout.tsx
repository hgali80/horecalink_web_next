import "./globals.css";
import type { ReactNode } from "react";

import Header from "./components/Header";
import VisitorTracker from "./components/VisitorTracker";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { getBaseUrl, getGoogleSiteVerification } from "./lib/server/siteConfig";

const baseUrl = getBaseUrl();
const googleSiteVerification = getGoogleSiteVerification();

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "HorecaLink",
    template: "%s | HorecaLink",
  },
  description:
    "HorecaLink.kz B2B HoReCa platformudur. Otel, restoran ve kafe ekipmanlari, proje cozumleri ve profesyonel tedarik hizmetleri sunar.",
  applicationName: "HorecaLink",
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: googleSiteVerification || undefined,
  },
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "HorecaLink",
    title: "HorecaLink",
    description:
      "Kazakhstan genelinde HoReCa profesyonelleri icin ekipman, proje ve tedarik platformu.",
    locale: "ru_KZ",
  },
  twitter: {
    card: "summary_large_image",
    title: "HorecaLink",
    description:
      "Kazakhstan genelinde HoReCa profesyonelleri icin ekipman, proje ve tedarik platformu.",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <LanguageProvider>
            <VisitorTracker />
            <Header />
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
