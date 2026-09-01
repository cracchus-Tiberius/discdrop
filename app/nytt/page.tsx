import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getLatestWeek, hasNewInStoresData } from "@/lib/new-in-stores";
import { WeekHero } from "@/components/nytt/WeekHero";
import { NewDiscTier } from "@/components/nytt/NewDiscTier";
import { NewReleases } from "@/components/nytt/NewReleaseCard";
import { StoreClusters } from "@/components/nytt/StoreCluster";
import { WeekArchive } from "@/components/nytt/WeekArchive";
import { BRAND_OG_IMAGE, OG_TYPE_WEBSITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Nytt i butikk — Diskgolf-disker | DiscDrop",
  description:
    "Nye disker, nye drops og nye lagerføringer vi har fanget opp hos norske og nordiske diskgolf-butikker, uke for uke.",
  alternates: { canonical: "https://discdrop.net/nytt/" },
  openGraph: {
    title: "Nytt i butikk — Diskgolf-disker | DiscDrop",
    description: "Nye disker og nye drops vi har fanget opp hos norske og nordiske diskgolf-butikker.",
    url: "https://discdrop.net/nytt/",
    type: OG_TYPE_WEBSITE,
    images: [BRAND_OG_IMAGE],
  },
};

export default function NyttPage() {
  const week = getLatestWeek();

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        {!hasNewInStoresData || !week ? (
          <section className="w-full px-5 py-20 md:px-10">
            <p className="mx-auto max-w-4xl text-center text-sm text-[#101C1499]">
              Ingen nye disker fanget opp ennå — sjekk igjen senere.
            </p>
          </section>
        ) : (
          <>
            <WeekHero week={week} isArchive={false} />
            <NewDiscTier signals={week.newDiscSignals} />
            <NewReleases signals={week.newReleaseSignals} />
            <StoreClusters groups={week.storeArrivals} />
            <WeekArchive currentSlug={week.slug} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
