import type { Metadata } from "next";
import { priceChangesSummary } from "@/lib/price-drops";
import { BRAND_OG_IMAGE, OG_TYPE_WEBSITE } from "@/lib/seo";

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
    type: OG_TYPE_WEBSITE,
    images: [BRAND_OG_IMAGE],
  },
};

export default function PrisfallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
