import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#080f1e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Tablero Ganadero · deCampoacampo",
  description: "Mercado Ganadero Digital — Indicadores ejecutivos y análisis de operaciones ganaderas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DCA Tablero",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/apple-icon.png",
  },
  other: {
    // Material Symbols Outlined — iconografía de deCampoacampo (disenio/tokens.json)
    "material-symbols": "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0",
  },
};

import Providers from "./providers";
import GlobalNav from "@/components/ui/GlobalNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
      className={`${inter.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <Providers>
          {children}
          <GlobalNav />
        </Providers>
      </body>
    </html>
  );
}
