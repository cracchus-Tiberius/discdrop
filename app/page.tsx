import type { Metadata } from "next";
import { DiscDropHome } from "./disc-drop-home";

export const metadata: Metadata = {
  title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
  description:
    "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus. Oppdatert daglig.",
  alternates: {
    canonical: "https://discdrop.net",
  },
  openGraph: {
    title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
    description:
      "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus. Oppdatert daglig.",
    url: "https://discdrop.net",
    images: [{ url: "/discdrop-logo-clean.svg" }],
  },
};

export default function Home() {
  return <DiscDropHome />;
}
