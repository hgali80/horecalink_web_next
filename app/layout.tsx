// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

import TopBar from "./components/TopBar";
import Header from "./components/Header";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

export const metadata = {
  title: "HorecaLink",
  icons: {
    icon: "/favicon.ico",
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
