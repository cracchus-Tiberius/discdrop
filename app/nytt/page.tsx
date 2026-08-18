import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getLatestWeek, getWeekIndex, hasNewInStoresData } from "@/lib/new-in-stores";
import { WeekView } from "./WeekView";

// Deliberately not linked from SiteHeader's nav or app/sitemap.ts yet — see
// scripts/lib/new-in-stores.js's header comment: the underlying firstSeen
// signal only became trustworthy after the mass-reset suppression fix
// landed 2026-08-17, and needs 1-2 weeks of stable counts before this is
// promoted. The page is fully live and functional at /nytt/ regardless —
// gating is "don't point people at it yet," not "hide it."

export const metadata: Metadata = {
  title: "Nytt i butikk — Diskgolf-disker | DiscDrop",
  description:
    "Nye disker, nye plastutgaver og nye butikk-lagerføringer vi har fanget opp hos norske og nordiske diskgolf-butikker, uke for uke.",
  alternates: { canonical: "https://discdrop.net/nytt/" },
  openGraph: {
    title: "Nytt i butikk — Diskgolf-disker | DiscDrop",
    description: "Nye disker og nye plastutgaver vi har fanget opp hos norske og nordiske diskgolf-butikker.",
    url: "https://discdrop.net/nytt/",
  },
};

export default function NyttPage() {
  const week = getLatestWeek();
  const weekIndex = getWeekIndex();

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        <section className="w-full border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#101C14] md:text-4xl">Nytt i butikk</h1>
            <p className="mt-3 max-w-[60ch] text-base text-[#101C1499]">
              Nye disker, nye plastutgaver og nye lagerføringer vi har fanget opp hos butikkene vi følger, uke for uke.
            </p>
          </div>
        </section>

        <section className="w-full bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            {!hasNewInStoresData || !week ? (
              <p className="py-10 text-center text-sm text-[#101C1499]">
                Ingen nye disker fanget opp ennå — sjekk igjen senere.
              </p>
            ) : (
              <WeekView week={week} weekIndex={weekIndex} isArchive={false} />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
