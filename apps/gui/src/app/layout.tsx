import type { ReactNode } from "react";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import { NavBar } from "@/components/nav/NavBar";
import "./globals.css";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-head",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Omnia",
  description: "Omnia Narrative Simulation Engine",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${archivoBlack.variable} ${spaceGrotesk.variable} min-h-dvh bg-background text-foreground font-sans`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
