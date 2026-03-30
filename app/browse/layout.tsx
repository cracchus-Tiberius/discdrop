import type { Metadata } from "next";
import { discs } from "@/data/discs.js";

const brandCount = new Set(discs.map((d) => d.brand)).size;

export const metadata: Metadata = {
  title: "Alle disker — Diskgolf prissammenligning | DiscDrop",
  description: `Bla gjennom ${discs.length} diskgolfdisker fra ${brandCount} merker. Filtrer på type, merke og pris. Finn beste pris fra norske butikker.`,
  alternates: {
    canonical: "https://discdrop.net/browse",
  },
  openGraph: {
    title: "Alle disker — Diskgolf prissammenligning | DiscDrop",
    description: `Bla gjennom ${discs.length} diskgolfdisker fra ${brandCount} merker. Filtrer på type, merke og pris.`,
    url: "https://discdrop.net/browse",
  },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
