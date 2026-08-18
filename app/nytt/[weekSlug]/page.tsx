import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getWeekBySlug, getWeekIndex } from "@/lib/new-in-stores";
import { WeekView } from "../WeekView";

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
  const description = `Nye disker, nye plastutgaver og nye lagerføringer i uke ${week.weekNumber} (${week.startDate} til ${week.endDate}) hos butikkene DiscDrop følger.`;
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

  const weekIndex = getWeekIndex();

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        <section className="w-full bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            <WeekView week={week} weekIndex={weekIndex} isArchive />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
