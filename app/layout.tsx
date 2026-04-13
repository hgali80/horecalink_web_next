// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

import Header from "./components/Header";
import VisitorTracker from "./components/VisitorTracker";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

export const metadata = {
  metadataBase: new URL("https://horecalink.kz"),
  title: {
    default: "HorecaLink",
    template: "%s | HorecaLink",
  },
  description:
    "HorecaLink.kz - B2B платформа для гостиниц, ресторанов и кафе в Казахстане: профессиональное оборудование, проектные решения, расходные материалы и поставки для HoReCa.",
  applicationName: "HorecaLink",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: "https://horecalink.kz",
    siteName: "HorecaLink",
    title: "HorecaLink",
    description:
      "B2B платформа для гостиниц, ресторанов и кафе в Казахстане: оборудование, проектные решения и профессиональные поставки для HoReCa.",
    locale: "ru_KZ",
  },
  twitter: {
    card: "summary_large_image",
    title: "HorecaLink",
    description:
      "B2B платформа для гостиниц, ресторанов и кафе в Казахстане: оборудование, проектные решения и профессиональные поставки для HoReCa.",
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
