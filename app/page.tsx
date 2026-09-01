import type { Metadata } from "next";
import { DiscDropHome } from "./disc-drop-home";
import { getLatestWeek } from "@/lib/new-in-stores";
import { BRAND_OG_IMAGE, OG_TYPE_WEBSITE } from "@/lib/seo";

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
    type: OG_TYPE_WEBSITE,
    images: [BRAND_OG_IMAGE],
  },
};

export default function Home() {
  // Post-suppression (mass-reset + weekly-cap) new-release count for the
  // live current week — same number /nytt itself shows, just surfaced here
  // as the "nye drops" chip. See lib/new-in-stores.ts / scripts/lib/
  // new-in-stores.js for how the underlying signal is classified.
  const newDropsThisWeek = getLatestWeek()?.newReleaseSignals.length ?? 0;
  return <DiscDropHome newDropsThisWeek={newDropsThisWeek} />;
}
