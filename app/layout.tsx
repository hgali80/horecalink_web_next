// app/layout.tsx
"use client";

import "./globals.css";
import type { ReactNode } from "react";

import TopBar from "./components/TopBar";
import Header from "./components/Header";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

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
