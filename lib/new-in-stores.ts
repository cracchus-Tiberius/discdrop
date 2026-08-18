// lib/new-in-stores.ts — shared data-access layer for the "Nytt i butikk"
// feature, read by app/nytt/page.tsx and app/nytt/[weekSlug]/page.tsx so the
// two never join against the catalog differently.
//
// All classification (new-disc / new-edition / new-at-store, mass-reset
// churn suppression) happens once, daily, in scripts/build-new-in-stores.js
// -> data/new-in-stores.json. This file only joins that already-classified
// data against the live catalog for rendering — it never recomputes
// signals, same pattern as lib/price-drops.ts does for price-changes.json.
import { discs } from "@/data/discs.js";
import newInStores from "@/data/new-in-stores.json";
import { getDiscImage } from "@/lib/disc-utils";

type Disc = (typeof discs)[number];

export type SignalType = "new-disc" | "new-edition" | "new-at-store";

export type SignalStoreEntry = {
  store: string;
  storeName: string;
  price: number;
  url: string;
};

type RawSignal = {
  discId: string;
  name: string;
  brand: string;
  image: string;
  type: SignalType;
  plastic: string | null;
  firstSeenMs: number;
  price: number;
  stores: SignalStoreEntry[];
};

type RawWeek = {
  isoWeek: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  signals: RawSignal[];
};

type NewInStoresData = {
  generated: string;
  summary: {
    totalSignals: number;
    newDiscs: number;
    newEditions: number;
    newAtStore: number;
    weeksIncluded: number;
    quarantinedStores: string[];
    suppressedMassResetEvents: { store: string; date: string; count: number }[];
  };
  weeks: RawWeek[];
};

const data = newInStores as NewInStoresData;
const discById = new Map((discs as Disc[]).map((d) => [d.id, d]));

/** A hero-card signal (new-disc or new-edition), joined against the live catalog. */
export type SignalRow = {
  discId: string;
  name: string;
  brand: string;
  image: string;
  type: SignalType;
  plastic: string | null;
  price: number;
  storeCount: number;
  stores: SignalStoreEntry[];
};

export type StoreArrivalGroup = {
  store: string;
  storeName: string;
  discs: { discId: string; name: string; brand: string; price: number; url: string }[];
};

export type Week = {
  isoWeek: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  slug: string;
  /** new-disc first, then new-edition — new-at-store is never a hero card. */
  heroSignals: SignalRow[];
  /** new-at-store signals regrouped by store instead of by disc. */
  storeArrivals: StoreArrivalGroup[];
};

export const newInStoresGenerated: string = data.generated;
export const newInStoresSummary = data.summary;
export const hasNewInStoresData: boolean = data.weeks.length > 0;

const HERO_TYPE_RANK: Record<SignalType, number> = { "new-disc": 0, "new-edition": 1, "new-at-store": 2 };

/** "2026-uke-34" — the /nytt/[weekSlug] URL segment for a given week. */
export function weekSlug(year: number, weekNumber: number): string {
  return `${year}-uke-${weekNumber}`;
}

/** Parses a "2026-uke-34"-style slug back into {year, weekNumber}, or null if malformed. */
export function parseWeekSlug(slug: string): { year: number; weekNumber: number } | null {
  const match = /^(\d{4})-uke-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  return { year: Number(match[1]), weekNumber: Number(match[2]) };
}

function buildWeek(raw: RawWeek): Week {
  // Images: the pipeline's own `image` field is a raw discs.js snapshot from
  // whenever it last ran, without disc-images.json's enrichment fallback —
  // resolve fresh via getDiscImage() here instead, same as every other page
  // that renders a disc image from a derived JSON file.
  const heroSignals: SignalRow[] = raw.signals
    .filter((s) => s.type !== "new-at-store")
    .map((s) => {
      const disc = discById.get(s.discId);
      return {
        discId: s.discId,
        name: s.name,
        brand: s.brand,
        image: disc ? getDiscImage(disc) : s.image,
        type: s.type,
        plastic: s.plastic,
        price: s.price,
        storeCount: s.stores.length,
        stores: s.stores,
      };
    })
    .sort((a, b) => HERO_TYPE_RANK[a.type] - HERO_TYPE_RANK[b.type]);

  const storeArrivals = groupStoreArrivals(raw.signals);

  return {
    isoWeek: raw.isoWeek,
    year: raw.year,
    weekNumber: raw.weekNumber,
    startDate: raw.startDate,
    endDate: raw.endDate,
    slug: weekSlug(raw.year, raw.weekNumber),
    heroSignals,
    storeArrivals,
  };
}

/** Regroups new-at-store signals (grouped by disc) by store instead — "Frisbeebutikken fikk inn 8 kjente disker". */
function groupStoreArrivals(signals: RawSignal[]): StoreArrivalGroup[] {
  const byStore = new Map<string, StoreArrivalGroup>();
  for (const s of signals) {
    if (s.type !== "new-at-store") continue;
    for (const st of s.stores) {
      if (!byStore.has(st.store)) {
        byStore.set(st.store, { store: st.store, storeName: st.storeName, discs: [] });
      }
      byStore.get(st.store)!.discs.push({ discId: s.discId, name: s.name, brand: s.brand, price: st.price, url: st.url });
    }
  }
  return [...byStore.values()].sort((a, b) => b.discs.length - a.discs.length);
}

/** All weeks with data, newest first (already sorted this way in the source JSON). */
export function getAllWeeks(): Week[] {
  return data.weeks.map(buildWeek);
}

/** The most recent week with any signals, or null if the pipeline has never run/produced data. */
export function getLatestWeek(): Week | null {
  const [first] = data.weeks;
  return first ? buildWeek(first) : null;
}

/** A specific week by its "2026-uke-34" slug, or null if that week has no data. */
export function getWeekBySlug(slug: string): Week | null {
  const parsed = parseWeekSlug(slug);
  if (!parsed) return null;
  const raw = data.weeks.find((w) => w.year === parsed.year && w.weekNumber === parsed.weekNumber);
  return raw ? buildWeek(raw) : null;
}

/** Lightweight index of every week with data, for archive nav — no catalog join needed. */
export function getWeekIndex(): { slug: string; weekNumber: number; year: number; startDate: string; endDate: string; totalSignals: number }[] {
  return data.weeks.map((w) => ({
    slug: weekSlug(w.year, w.weekNumber),
    weekNumber: w.weekNumber,
    year: w.year,
    startDate: w.startDate,
    endDate: w.endDate,
    totalSignals: w.signals.length,
  }));
}

/**
 * Norwegian headline for a week's hero signals, e.g. "3 nye utgaver" or
 * "2 nye disker og 5 nye utgaver". Omits a count entirely when it's zero —
 * new-disc is legitimately empty some weeks and should never render as
 * "0 nye disker". Falls back to a neutral phrase if only store-arrivals
 * happened this week (heroSignals empty but storeArrivals isn't).
 */
export function weekHeadline(week: Week): string {
  const newDiscCount = week.heroSignals.filter((s) => s.type === "new-disc").length;
  const newEditionCount = week.heroSignals.filter((s) => s.type === "new-edition").length;
  const parts: string[] = [];
  if (newDiscCount > 0) parts.push(`${newDiscCount} ${newDiscCount === 1 ? "ny disk" : "nye disker"}`);
  if (newEditionCount > 0) parts.push(`${newEditionCount} ${newEditionCount === 1 ? "ny utgave" : "nye utgaver"}`);
  if (parts.length === 0) return "Nytt i butikkutvalget";
  return parts.join(" og ");
}
