import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 1. Importa il componente Toaster
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pasceri Consulting",
  description: "Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={inter.className}>
        {children}
        {/* 2. Aggiungilo qui, prima della chiusura del body */}
        <Toaster />
      </body>
    </html>
  );
}