// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

import TopBar from "./components/TopBar";
import Header from "./components/Header";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

export const metadata = {
  metadataBase: new URL("https://horecalink.kz"),
  title: "HorecaLink",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};



export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>
          <LanguageProvider>
            <TopBar />
            <Header />
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
