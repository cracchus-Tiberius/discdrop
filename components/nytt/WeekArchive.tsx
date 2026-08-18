import Link from "next/link";
import { getWeekIndex } from "@/lib/new-in-stores";

const SHORT_MONTHS = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

function shortDateRange(startDate: string, endDate: string): string {
  const [, , startDay] = startDate.split("-");
  const [, endMonth, endDay] = endDate.split("-");
  return `${Number(startDay)}.–${Number(endDay)}. ${SHORT_MONTHS[Number(endMonth) - 1]}`;
}

/** "Bla i tidligere uker" — a real section (with week cards), not filter pills stuffed into the footer. */
export function WeekArchive({ currentSlug }: { currentSlug: string }) {
  const otherWeeks = getWeekIndex().filter((w) => w.slug !== currentSlug);
  if (otherWeeks.length === 0) return null;

  const shown = otherWeeks.slice(0, 4);
  const hasMore = otherWeeks.length > shown.length;

  return (
    <section className="px-5 py-9 md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <h2 className="text-[22px] font-extrabold text-[#101C14] md:text-[26px]">Bla i tidligere uker</h2>
            <p className="text-[15px] text-[#101C1499]">Hver uke siden vi startet å følge butikkene.</p>
          </div>
          {hasMore && (
            <Link
              href={`/nytt/${otherWeeks[otherWeeks.length - 1].slug}/`}
              className="text-sm font-bold text-[#101C14] underline decoration-[#B8E04A] decoration-2 underline-offset-4"
            >
              Hele arkivet →
            </Link>
          )}
        </div>

        {/* Desktop: card grid */}
        <div className="mt-6 hidden gap-4 md:grid md:grid-cols-4">
          {shown.map((w) => (
            <Link
              key={w.slug}
              href={`/nytt/${w.slug}/`}
              className="flex flex-col gap-3 rounded-2xl border-2 border-[#101C14] bg-white p-4 shadow-[3px_3px_0_#101C14] transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div>
                <p className="text-[22px] font-extrabold tracking-[-0.03em] text-[#101C14]">Uke {w.weekNumber}</p>
                <p className="text-xs font-bold text-[#101C1477]">{shortDateRange(w.startDate, w.endDate)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {w.newReleases > 0 && (
                  <span className="rounded-lg bg-[#B8E04A] px-[9px] py-1 text-xs font-extrabold text-[#101C14]">
                    {w.newReleases} {w.newReleases === 1 ? "drop" : "drops"}
                  </span>
                )}
                {w.newAtStore > 0 && (
                  <span className="rounded-lg bg-[#F1EFE6] px-[9px] py-1 text-xs font-extrabold text-[#101C14]">
                    {w.newAtStore} lagerføringer
                  </span>
                )}
              </div>
              {w.highlight && <p className="truncate text-[13px] font-bold text-[#101C1499]">{w.highlight}</p>}
            </Link>
          ))}
        </div>

        {/* Mobile: row list */}
        <div className="mt-6 flex flex-col md:hidden">
          {shown.map((w) => (
            <Link
              key={w.slug}
              href={`/nytt/${w.slug}/`}
              className="flex min-h-[56px] items-center justify-between gap-3 border-b-2 border-[#F1EFE6] py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-[20px] font-extrabold text-[#101C14]">Uke {w.weekNumber}</p>
                <p className="truncate text-xs text-[#101C1499]">
                  {shortDateRange(w.startDate, w.endDate)} ·{" "}
                  {w.newReleases > 0 ? `${w.newReleases} ${w.newReleases === 1 ? "drop" : "drops"}` : null}
                  {w.newReleases > 0 && w.newAtStore > 0 ? " · " : ""}
                  {w.newAtStore > 0 ? `${w.newAtStore} lagerføringer` : null}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#101C1466" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
          {hasMore && (
            <Link
              href={`/nytt/${otherWeeks[otherWeeks.length - 1].slug}/`}
              className="flex min-h-[56px] items-center text-sm font-bold text-[#101C14] underline decoration-[#B8E04A] decoration-2 underline-offset-4"
            >
              Hele arkivet →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
