import {
  badgeStyles,
  getBestInStockNOK,
  releaseBadge,
  type Disc,
} from "@/lib/disc-utils";
import { FlightNumbers } from "@/components/FlightNumbers";

export default function HotDrops({ items }: { items: Disc[] }) {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Hot Drops
            </h2>
            <p className="mt-1 text-sm text-muted">
              Limited runs and tour plastic worth watching.
            </p>
          </div>
        </div>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:thin] [scrollbar-color:rgba(122,154,130,0.4)_transparent] sm:mx-0 sm:px-0">
          {items.map((d) => {
            const badge = releaseBadge(d);
            const { best, storeCount } = getBestInStockNOK(d);
            const hasStock = d.stores.some((s) => s.inStock);
            const tags = d.tags as string[];
            const isHotTagged = tags.includes("hot");
            return (
              <article
                key={d.id}
                className={`flex min-h-[26rem] w-[min(100%,340px)] shrink-0 snap-start flex-col rounded-2xl border bg-surface p-6 shadow-lg shadow-black/20 transition-[box-shadow,border-color] ${
                  isHotTagged
                    ? "border-accent/35 shadow-[0_0_52px_-14px_rgba(184,224,74,0.42),0_0_0_1px_rgba(184,224,74,0.22)] ring-1 ring-accent/30"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeStyles(badge)}`}
                  >
                    {badge}
                  </span>
                </div>
                <h3 className="mt-5 font-heading text-xl font-semibold leading-snug text-foreground">
                  {d.name}
                </h3>
                <p className="text-sm text-muted">{d.brand}</p>
                {"player" in d && d.player ? (
                  <p className="mt-1 text-sm text-foreground/90">{d.player}</p>
                ) : null}
                <FlightNumbers flight={d.flight} className="mt-4" />
                <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-white/10 pt-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">
                      Best price
                    </p>
                    <p className="font-heading text-2xl font-semibold text-accent">
                      {best} kr
                    </p>
                    <p className="text-xs text-muted">
                      {storeCount} store
                      {storeCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      hasStock
                        ? "bg-accent text-background hover:brightness-110"
                        : "bg-white/10 text-foreground ring-1 ring-white/15 hover:bg-white/15"
                    }`}
                  >
                    {hasStock ? "Find it" : "Notify me"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
