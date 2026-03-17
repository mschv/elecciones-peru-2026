import type { Metadata } from "next";
import localFont from "next/font/local";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import BottomTabs from "@/components/layout/BottomTabs";
import CompareTray from "@/components/comparar/CompareTray";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Elecciones Perú 2026",
  description: "Información sobre candidatos y partidos para las elecciones generales del Perú 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased text-gray-900`}
      >
        <Navbar />
        {/* pb-16 on mobile to clear the fixed bottom tab bar */}
        <main className="pb-16 md:pb-0">{children}</main>
        <BottomTabs />
        <CompareTray />
      </body>
    </html>
  );
}
