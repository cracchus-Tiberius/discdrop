// lib/new-in-stores.ts — shared data-access layer for the "Nytt i butikk"
// feature, read by app/nytt/page.tsx and app/nytt/[weekSlug]/page.tsx so the
// two never join against the catalog differently.
//
// All classification (new-disc / new-release / new-at-store, mass-reset
// churn suppression, edition-marker normalization, week freezing) happens
// once, daily, in scripts/build-new-in-stores.js -> one file per ISO week
// under data/new-in-stores/ (2026-W35.json, ...) plus data/new-in-stores/
// _meta.json for cross-week bookkeeping. This file only joins that
// already-classified, already-frozen data against the live catalog for
// rendering — it never recomputes signals, same pattern as lib/price-drops.ts
// does for price-changes.json.
//
// Read via fs, not a static `import ... from "@/data/..."`, because the set
// of week files isn't known at bundle time. Safe here specifically because
// this module is only ever imported by Server Components (app/nytt/page.tsx,
// app/nytt/[weekSlug]/page.tsx) that run during `next build`'s static
// export — never bundled for the client.
import fs from "node:fs";
import path from "node:path";
import { discs } from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";
import { getDiscImage } from "@/lib/disc-utils";

type Disc = (typeof discs)[number];
type StoreMeta = { name: string; shipping?: number; freeShippingOver?: number };

/** "new-release" is "Ny drop" everywhere in the UI — never "ny utgave"/"slipp". */
export type SignalType = "new-disc" | "new-release" | "new-at-store";

type RawStoreEntry = { store: string; storeName: string; price: number; url: string };

type RawSignal = {
  discId: string;
  name: string;
  brand: string;
  image: string;
  type: SignalType;
  plastic: string | null;
  edition: string | null;
  firstSeenMs: number;
  price: number;
  stores: RawStoreEntry[];
};

type RawWeek = {
  isoWeek: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  frozen: boolean;
  generated: string;
  signals: RawSignal[];
};

type NewInStoresMeta = {
  generated: string;
  currentIsoWeek: string;
  summary: {
    totalSignals: number;
    newDiscs: number;
    newReleases: number;
    newAtStore: number;
    weeksIncluded: number;
    quarantinedStores: string[];
    suppressedMassResetEvents: { store: string; date: string; count: number }[];
    suppressedWeeklyCapEvents: { store: string; isoWeek: string; count: number }[];
  };
  weeks: { isoWeek: string; year: number; weekNumber: number; startDate: string; endDate: string; frozen: boolean }[];
};

const WEEKS_DIR = path.join(process.cwd(), "data", "new-in-stores");
const WEEK_FILE_RE = /^(\d{4}-W\d{2})\.json$/;

function loadMeta(): NewInStoresMeta | null {
  const metaPath = path.join(WEEKS_DIR, "_meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf8")) as NewInStoresMeta;
}

/** Every week file on disk, newest ISO week first. Empty if the pipeline has never run. */
function loadWeeks(): RawWeek[] {
  if (!fs.existsSync(WEEKS_DIR)) return [];
  const weeks: RawWeek[] = [];
  for (const filename of fs.readdirSync(WEEKS_DIR)) {
    if (!WEEK_FILE_RE.test(filename)) continue;
    const raw = fs.readFileSync(path.join(WEEKS_DIR, filename), "utf8");
    weeks.push(JSON.parse(raw) as RawWeek);
  }
  weeks.sort((a, b) => b.isoWeek.localeCompare(a.isoWeek));
  return weeks;
}

// Read once per build — this module is evaluated once and its exports
// reused across every page/route that imports it, same as the old static
// JSON import did.
const meta = loadMeta();
const allWeeks = loadWeeks();
const discById = new Map((discs as Disc[]).map((d) => [d.id, d]));
const storesMeta = scrapedPrices.stores as Record<string, StoreMeta>;

/**
 * The pipeline (scripts/lib/new-in-stores.js) already runs every store
 * price through entryLandedNOK() — the same diskpris+frakt formula the disc
 * detail page's price table uses — so a signal's stored `price` per store
 * IS already a landed total. What this checks is whether that total is
 * TRUSTWORTHY: if a store's meta is missing `shipping` entirely,
 * entryLandedNOK() silently adds 0 rather than a real shipping cost, which
 * would otherwise render as "fra, inkl. frakt kr X" while actually excluding
 * shipping — a dishonest total. Every store currently has shipping data, so
 * this is a defensive check against a future/incomplete store, not
 * something that changes today's numbers.
 */
function hasKnownShipping(store: string): boolean {
  return storesMeta[store]?.shipping != null;
}

export type SignalStoreEntry = {
  store: string;
  storeName: string;
  price: number;
  url: string;
  hasShippingData: boolean;
};

/** A hero-card signal (new-disc or new-release), joined against the live catalog. */
export type SignalRow = {
  discId: string;
  name: string;
  brand: string;
  discType: string;
  image: string;
  flight: { speed: number; glide: number; turn: number; fade: number } | null;
  type: SignalType;
  plastic: string | null;
  /** Raw edition text (e.g. "Tour Series", "Henna Blomroos") — the news itself for a new-release signal. Null for a plain plastic-only release. */
  edition: string | null;
  firstSeenMs: number;
  /** Cheapest offer among this signal's stores. */
  price: number;
  hasShippingData: boolean;
  storeCount: number;
  stores: SignalStoreEntry[];
};

export type StoreArrivalGroup = {
  store: string;
  storeName: string;
  discs: {
    discId: string;
    name: string;
    brand: string;
    plastic: string | null;
    image: string;
    price: number;
    hasShippingData: boolean;
    url: string;
  }[];
};

export type Week = {
  isoWeek: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  slug: string;
  newDiscSignals: SignalRow[];
  newReleaseSignals: SignalRow[];
  storeArrivals: StoreArrivalGroup[];
  /** Total individual (disc, store) arrivals across all store-arrival groups — the "18" in "18 hos 7 butikker". */
  totalStoreArrivals: number;
  /** Distinct stores that had ANY signal this week (all three types combined). */
  storeCount: number;
};

export const newInStoresGenerated: string = meta?.generated ?? "";
export const newInStoresSummary = meta?.summary ?? null;
export const hasNewInStoresData: boolean = allWeeks.length > 0;

function enrichStore(s: RawStoreEntry): SignalStoreEntry {
  return { ...s, hasShippingData: hasKnownShipping(s.store) };
}

function buildSignalRow(s: RawSignal): SignalRow {
  const disc = discById.get(s.discId);
  const stores = s.stores.map(enrichStore).sort((a, b) => a.price - b.price);
  const cheapest = stores[0];
  return {
    discId: s.discId,
    name: s.name,
    brand: s.brand,
    discType: disc?.type ?? "",
    // Resolve fresh via getDiscImage() (disc-images.json enrichment, scraped
    // fallback) rather than trusting the pipeline's raw discs.js snapshot.
    image: disc ? getDiscImage(disc) : s.image,
    flight: disc ? disc.flight : null,
    type: s.type,
    plastic: s.plastic,
    edition: s.edition,
    firstSeenMs: s.firstSeenMs,
    price: cheapest?.price ?? s.price,
    hasShippingData: cheapest?.hasShippingData ?? false,
    storeCount: stores.length,
    stores,
  };
}

function buildWeek(raw: RawWeek): Week {
  const newDiscSignals = raw.signals.filter((s) => s.type === "new-disc").map(buildSignalRow);
  const newReleaseSignals = raw.signals.filter((s) => s.type === "new-release").map(buildSignalRow);
  const storeArrivals = groupStoreArrivals(raw.signals);
  const totalStoreArrivals = storeArrivals.reduce((sum, g) => sum + g.discs.length, 0);

  const storeSet = new Set<string>();
  for (const s of raw.signals) for (const st of s.stores) storeSet.add(st.store);

  return {
    isoWeek: raw.isoWeek,
    year: raw.year,
    weekNumber: raw.weekNumber,
    startDate: raw.startDate,
    endDate: raw.endDate,
    slug: weekSlug(raw.year, raw.weekNumber),
    newDiscSignals,
    newReleaseSignals,
    storeArrivals,
    totalStoreArrivals,
    storeCount: storeSet.size,
  };
}

/** Regroups new-at-store signals (grouped by disc) by store instead — "Frisbeebutikken fikk inn 8 kjente disker". */
function groupStoreArrivals(signals: RawSignal[]): StoreArrivalGroup[] {
  const byStore = new Map<string, StoreArrivalGroup>();
  for (const s of signals) {
    if (s.type !== "new-at-store") continue;
    const disc = discById.get(s.discId);
    const image = disc ? getDiscImage(disc) : s.image;
    for (const st of s.stores) {
      if (!byStore.has(st.store)) {
        byStore.set(st.store, { store: st.store, storeName: st.storeName, discs: [] });
      }
      byStore.get(st.store)!.discs.push({
        discId: s.discId,
        name: s.name,
        brand: s.brand,
        plastic: s.plastic,
        image,
        price: st.price,
        hasShippingData: hasKnownShipping(st.store),
        url: st.url,
      });
    }
  }
  return [...byStore.values()].sort((a, b) => b.discs.length - a.discs.length);
}

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

/** All weeks with data, newest first (already sorted this way on disk). */
export function getAllWeeks(): Week[] {
  return allWeeks.map(buildWeek);
}

/**
 * The live current ISO week (matches _meta.json's currentIsoWeek — the one
 * week that's still being recomputed every run, never frozen), or null if
 * the pipeline has never run/produced data. Falls back to the newest week
 * on disk if the meta file is somehow missing or stale, so /nytt still
 * renders something rather than going blank.
 */
export function getLatestWeek(): Week | null {
  const live = meta ? allWeeks.find((w) => w.isoWeek === meta.currentIsoWeek) : undefined;
  const raw = live ?? allWeeks[0];
  return raw ? buildWeek(raw) : null;
}

/** A specific week by its "2026-uke-34" slug, or null if that week has no data. */
export function getWeekBySlug(slug: string): Week | null {
  const parsed = parseWeekSlug(slug);
  if (!parsed) return null;
  const raw = allWeeks.find((w) => w.year === parsed.year && w.weekNumber === parsed.weekNumber);
  return raw ? buildWeek(raw) : null;
}

/** Lightweight index of every week with data, for archive nav — no catalog join needed. */
export function getWeekIndex(): {
  slug: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  newReleases: number;
  newAtStore: number;
  highlight: string;
}[] {
  return allWeeks.map((w) => {
    const releases = w.signals.filter((s) => s.type === "new-release");
    const highlightSignals = w.signals.filter((s) => s.type !== "new-at-store");
    return {
      slug: weekSlug(w.year, w.weekNumber),
      weekNumber: w.weekNumber,
      year: w.year,
      startDate: w.startDate,
      endDate: w.endDate,
      newReleases: releases.length,
      newAtStore: w.signals.filter((s) => s.type === "new-at-store").length,
      highlight: highlightSignals
        .slice(0, 2)
        .map((s) => `${s.brand} ${s.name}`)
        .join(" · "),
    };
  });
}

const NORWEGIAN_MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];
const NORWEGIAN_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** "17.–23. AUGUST" from a week's ISO startDate/endDate. */
export function formatWeekDateRange(startDate: string, endDate: string): string {
  const [, , startDay] = startDate.split("-");
  const [, endMonth, endDay] = endDate.split("-");
  const month = NORWEGIAN_MONTHS[Number(endMonth) - 1].toUpperCase();
  return `${Number(startDay)}.–${Number(endDay)}. ${month}`;
}

/** Uppercase Norwegian weekday name for a firstSeen timestamp, e.g. "TIRSDAG". */
export function weekdayLabel(ms: number): string {
  return NORWEGIAN_WEEKDAYS[new Date(ms).getUTCDay()].toUpperCase();
}

/**
 * Deterministic (not random — avoids hydration mismatch) hero headline that
 * varies by week, per design_handoff_nytt/README.md. `weekIndexInList` is
 * the week's position in the newest-first week list (0 = latest).
 */
export function weekHeroHeadline(week: Week, weekIndexInList: number): string {
  const n = week.newReleaseSignals.length;
  const variants = [
    "Ukas drops er landet.",
    n > 0 ? `Denne uka droppet det ${n} ${n === 1 ? "ny drop" : "nye drops"}.` : "Ukas drops er landet.",
    "Nytt på hyllene denne uka.",
  ];
  return variants[weekIndexInList % variants.length];
}

/** "kl. 06:12" style time, formatted in Norwegian time from the build's ASOF snapshot — never Date.now(). */
export function formatCheckedAtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }).format(
    new Date(iso)
  );
}
