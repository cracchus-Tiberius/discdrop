import type { Metadata } from "next";
import { priceChangesSummary } from "@/lib/price-drops";

export const metadata: Metadata = {
  title: "Prisfall — Diskgolf prissammenligning | DiscDrop",
  description: `Se de største prisfallene på diskgolfdisker akkurat nå, fra ${priceChangesSummary.storesChecked} norske butikker. Rangert liste, oppdatert daglig.`,
  alternates: {
    canonical: "https://discdrop.net/prisfall",
  },
  openGraph: {
    title: "Prisfall — Diskgolf prissammenligning | DiscDrop",
    description: `Se de største prisfallene på diskgolfdisker akkurat nå, fra ${priceChangesSummary.storesChecked} norske butikker.`,
    url: "https://discdrop.net/prisfall",
  },
};

export default function PrisfallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
