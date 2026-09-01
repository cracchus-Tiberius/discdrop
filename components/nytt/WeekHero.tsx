import type { Week } from "@/lib/new-in-stores";
import { formatWeekDateRange, weekHeroHeadline, formatCheckedAtTime } from "@/lib/new-in-stores";
import { scrapedLastUpdated } from "@/lib/disc-utils";
import { dropsLabel, storesLabel, stockingsLabel } from "@/lib/pluralize";

/** "Uka som event" — calendar block, headline, and a dark stats strip glued to the section's bottom edge. */
export function WeekHero({
  week,
  isArchive,
}: {
  week: Week;
  isArchive: boolean;
}) {
  const dateRange = formatWeekDateRange(week.startDate, week.endDate);
  const kicker = isArchive ? `${dateRange} ${week.year}` : `${dateRange} · DENNE UKA`;
  const isQuietWeek =
    week.newDiscSignals.length === 0 && week.newReleaseSignals.length === 0 && week.storeArrivals.length === 0;
  const headline = isQuietWeek ? "Rolig uke. Ingen nye drops fanget opp." : weekHeroHeadline();
  const [firstLine, ...rest] = headline.split(" ");
  const lastWord = rest.pop();
  const checkedAt = !isArchive ? formatCheckedAtTime(scrapedLastUpdated) : null;

  return (
    <section className="w-full border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 pt-7 md:px-10 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end gap-3.5 md:grid md:grid-cols-[auto_1fr] md:items-end md:gap-9">
          <div className="shrink-0 rounded-2xl border-2 border-[#101C14] bg-[#B8E04A] px-4 pb-3 pt-2.5 text-center shadow-[4px_4px_0_#101C14] md:rounded-[20px] md:px-[26px] md:pb-[18px] md:pt-4 md:shadow-[5px_5px_0_#101C14]">
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#101C14] md:text-[12px]">UKE</div>
            <div className="text-[40px] font-extrabold leading-[0.86] tracking-[-0.05em] text-[#101C14] md:text-[76px]">
              {week.weekNumber}
            </div>
            <div className="mt-1.5 hidden text-[13px] font-bold text-[#101C14] md:block">{week.year}</div>
          </div>

          <div>
            <p className="text-[13px] font-extrabold tracking-[0.14em] text-[#101C1499] md:text-sm">{kicker}</p>
            <h1 className="mt-1 text-[40px] font-extrabold leading-[0.96] tracking-[-0.035em] text-[#101C14] md:mt-2 md:text-[64px]">
              {firstLine} {rest.join(" ")}{" "}
              <span style={{ backgroundImage: "linear-gradient(transparent 62%, #B8E04A 62%)" }}>{lastWord}</span>
            </h1>
          </div>
        </div>

        <p className="mt-4 max-w-[62ch] text-base leading-[1.55] text-[#101C14]/70 md:mt-3 md:text-lg">
          Nye disker, nye drops og nye lagerføringer vi har fanget opp hos butikkene vi følger — samlet uke for uke.
        </p>

        {/* Stats strip — glued to the section's bottom edge (no bottom padding on the section itself). */}
        <div className="mt-9 overflow-hidden rounded-t-[18px] border-2 border-b-0 border-[#101C14] bg-[#1E3D2F] text-[#FFFDF6]">
          <div className="flex md:hidden">
            <StatCellMobile value={week.newReleaseSignals.length} label={dropsLabel(week.newReleaseSignals.length)} />
            <StatCellMobile value={week.totalStoreArrivals} label={stockingsLabel(week.totalStoreArrivals)} border />
            <StatCellMobile value={week.storeCount} label={storesLabel(week.storeCount)} border />
          </div>
          {checkedAt && (
            <div className="border-t border-[#FFFDF6]/[0.16] px-[18px] pb-[11px] pt-[11px] text-[13px] font-semibold text-[#FFFDF677] md:hidden">
              Sist sjekket i dag kl. {checkedAt}
            </div>
          )}

          <div className="hidden md:flex">
            <StatCellDesktop value={week.newReleaseSignals.length} label={dropsLabel(week.newReleaseSignals.length)} accent />
            <StatCellDesktop value={week.totalStoreArrivals} label={stockingsLabel(week.totalStoreArrivals)} border />
            <StatCellDesktop value={week.storeCount} label={storesLabel(week.storeCount)} border />
            {checkedAt && (
              <div className="ml-auto flex shrink-0 items-center gap-2.5 border-l border-[#FFFDF6]/[0.16] px-[26px] py-5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#B8E04A]" aria-hidden />
                <span className="text-[13px] font-semibold text-[#FFFDF677]">Sist sjekket i dag kl. {checkedAt}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCellDesktop({ value, label, accent, border }: { value: number; label: string; accent?: boolean; border?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2.5 px-[26px] py-5 ${border ? "border-l border-[#FFFDF6]/[0.16]" : ""}`}>
      <span className={`text-[34px] font-extrabold tracking-[-0.03em] ${accent ? "text-[#B8E04A]" : "text-[#FFFDF6]"}`}>
        {value}
      </span>
      <span className="text-[15px] font-semibold text-[#FFFDF6cc]">{label}</span>
    </div>
  );
}

function StatCellMobile({ value, label, border }: { value: number; label: string; border?: boolean }) {
  return (
    <div className={`flex-1 px-[14px] py-4 ${border ? "border-l border-[#FFFDF6]/[0.16]" : ""}`}>
      <div className="text-[26px] font-extrabold text-[#FFFDF6]">{value}</div>
      <div className="text-[11px] font-semibold text-[#FFFDF699]">{label}</div>
    </div>
  );
}
