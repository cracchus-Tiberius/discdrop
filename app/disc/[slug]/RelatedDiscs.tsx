/**
 * "Lignende disker" on a disc page.
 *
 * A server component on purpose, with plain <a>-equivalent Link elements and
 * no client state, so all of it lands in the prerendered HTML. The reason this
 * section exists is as much the link graph as the reader: before it, a disc
 * page's only outbound link into the catalogue was its own brand page, which
 * left Google with 702 near-leaf pages and 115 it could reach from nowhere but
 * sitemap.xml. This adds about eight links per page, and the nearest-by-flight
 * rule spreads them — 698 of 702 discs end up with at least one link pointing
 * at them, median seven.
 *
 * No images here, deliberately: the cards are text, so the section costs
 * nothing in requests and cannot push the price table below the fold.
 */

import Link from "next/link";
import { discs } from "@/data/discs.js";
import { relatedDiscs, type RelatableDisc } from "@/lib/related";
import { getScrapedPrice } from "@/lib/disc-utils";

const TYPE_LABEL: Record<string, string> = {
  putter: "Putter",
  midrange: "Midrange",
  fairway: "Fairway driver",
  distance: "Distance driver",
};

// Explicit, because suffixing the singular gives "midrangee". "disker", not
// "discer" — see CLAUDE.md.
const TYPE_PLURAL: Record<string, string> = {
  putter: "puttere",
  midrange: "midrange-disker",
  fairway: "fairway drivere",
  distance: "distance drivere",
};

function flightLine(f: { speed: number; glide: number; turn: number; fade: number }) {
  return `${f.speed} / ${f.glide} / ${f.turn} / ${f.fade}`;
}

function DiscCard({ disc }: { disc: RelatableDisc }) {
  const { price } = getScrapedPrice(disc.id);
  return (
    <Link
      href={`/disc/${disc.id}/`}
      className="flex flex-col rounded-2xl border-2 border-[#101C14] bg-white p-4 transition-transform duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0_#B8E04A]"
    >
      <span className="text-xs font-semibold text-[#101C1488]">{disc.brand}</span>
      <span className="mt-0.5 font-extrabold leading-tight text-[#101C14]">{disc.name}</span>
      <span className="mt-2 text-xs font-semibold text-[#101C1488]">
        {TYPE_LABEL[disc.type] ?? disc.type} · {flightLine(disc.flight)}
      </span>
      <span className="mt-2 text-sm font-bold text-[#2D6A4F]">
        {price != null ? `fra kr ${Math.round(price)}` : "Ingen priser nå"}
      </span>
    </Link>
  );
}

function Group({ heading, items }: { heading: string; items: RelatableDisc[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-extrabold tracking-tight text-[#101C14]">{heading}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((d) => (
          <DiscCard key={d.id} disc={d} />
        ))}
      </div>
    </section>
  );
}

export function RelatedDiscs({ discId }: { discId: string }) {
  const all = discs as RelatableDisc[];
  const disc = all.find((d) => d.id === discId);
  if (!disc) return null;

  const { sameBrand, similar } = relatedDiscs(disc, all);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-4 md:px-10">
      <Group heading={`Mer fra ${disc.brand}`} items={sameBrand} />
      <Group heading={`Lignende ${TYPE_PLURAL[disc.type] ?? "disker"}`} items={similar} />
    </div>
  );
}
