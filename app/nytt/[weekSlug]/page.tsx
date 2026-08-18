import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllWeeks, getWeekBySlug, getWeekIndex } from "@/lib/new-in-stores";
import { WeekHero } from "@/components/nytt/WeekHero";
import { NewDiscTier } from "@/components/nytt/NewDiscTier";
import { NewReleases } from "@/components/nytt/NewReleaseCard";
import { StoreClusters } from "@/components/nytt/StoreCluster";
import { WeekArchive } from "@/components/nytt/WeekArchive";

// See app/nytt/page.tsx's header comment — these archive pages are live and
// statically generated for every week we have data for, but not linked from
// anywhere outside the /nytt/ cluster itself until the feature is promoted.

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
    openGraph: { title, description, url: canonical },
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

  const weekIndexInList = getAllWeeks().findIndex((w) => w.slug === slug);

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        <WeekHero week={week} weekIndexInList={weekIndexInList} isArchive />
        <NewDiscTier signals={week.newDiscSignals} />
        <NewReleases signals={week.newReleaseSignals} />
        <StoreClusters groups={week.storeArrivals} />
        <WeekArchive currentSlug={week.slug} />
      </main>
      <SiteFooter />
    </div>
  );
}
