import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getWeekBySlug, getWeekIndex } from "@/lib/new-in-stores";
import { WeekHero } from "@/components/nytt/WeekHero";
import { NewDiscTier } from "@/components/nytt/NewDiscTier";
import { NewReleases } from "@/components/nytt/NewReleaseCard";
import { StoreClusters } from "@/components/nytt/StoreCluster";
import { WeekArchive } from "@/components/nytt/WeekArchive";
import { BRAND_OG_IMAGE, OG_TYPE_WEBSITE } from "@/lib/seo";

export function generateStaticParams() {
  return getWeekIndex().map((w) => ({ weekSlug: w.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ weekSlug: string }>;
}): Promise<Metadata> {
  const { weekSlug: slug } = await params;
  const week = getWeekBySlug(slug);
  if (!week) return {};

  const title = `Nye diskgolf-disker uke ${week.weekNumber} ${week.year} | DiscDrop`;
  const description = `Nye disker, nye drops og nye lagerføringer i uke ${week.weekNumber} (${week.startDate} til ${week.endDate}) hos butikkene DiscDrop følger.`;
  const canonical = `https://discdrop.net/nytt/${slug}/`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: OG_TYPE_WEBSITE, images: [BRAND_OG_IMAGE] },
  };
}

export default async function NyttWeekPage({
  params,
}: {
  params: Promise<{ weekSlug: string }>;
}) {
  const { weekSlug: slug } = await params;
  const week = getWeekBySlug(slug);
  if (!week) notFound();

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        <WeekHero week={week} isArchive />
        <NewDiscTier signals={week.newDiscSignals} />
        <NewReleases signals={week.newReleaseSignals} />
        <StoreClusters groups={week.storeArrivals} />
        <WeekArchive currentSlug={week.slug} />
      </main>
      <SiteFooter />
    </div>
  );
}
