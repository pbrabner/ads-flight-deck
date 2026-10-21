import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = { title: { default: "Ads Flight Deck", template: "%s | Ads Flight Deck" }, description: "Sua operação de mídia, em uma visão clara." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={cn("font-sans", geist.variable)}><body>{children}</body></html>;
}
