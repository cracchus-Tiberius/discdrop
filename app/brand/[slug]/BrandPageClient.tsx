"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { DiscImage } from "@/components/DiscImage";
import { getScrapedPrice, getDiscImage } from "@/lib/disc-utils";
import { discs } from "@/data/discs.js";
import topSellers from "@/data/top-sellers.json";

type Disc = (typeof discs)[number];

type TypeFilter = "all" | "distance" | "fairway" | "midrange" | "putter";

const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "distance", label: "Distance Driver" },
  { id: "fairway", label: "Fairway Driver" },
  { id: "midrange", label: "Midrange" },
  { id: "putter", label: "Putter" },
];

const TYPE_LABEL: Record<string, string> = {
  driver: "Driver",
  midrange: "Mid-range",
  putter: "Putter",
};

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#E8704A", text: "#fff", label: "HOT" },
  new: { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "BEGRENSET" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
};

// Logo extension map — must match public/images/brands/ files
const BRAND_LOGO_EXT: Record<string, string> = {
  "mvp": "svg",
  "axiom": "svg",
  "streamline": "svg",
  "westside-discs": "avif",
  "dynamic-discs": "svg",
  "discmania": "jpg",
  "latitude-64": "jpg",
};
const BRAND_LOGO_LARGE = new Set(["mvp", "axiom", "streamline"]);

// Score map from top-sellers.json
const scoreMap = new Map<string, number>(
  (topSellers.discs as { catalogId: string; score: number }[]).map((d) => [
    d.catalogId,
    d.score,
  ])
);

function sortDiscs(list: Disc[]): Disc[] {
  return [...list].sort((a, b) => {
    const sa = scoreMap.get(a.id) ?? -1;
    const sb = scoreMap.get(b.id) ?? -1;
    if (sa !== sb) return sb - sa; // higher score first
    if (sa === -1 && sb === -1) return a.name.localeCompare(b.name, "nb"); // alphabetical fallback
    return 0;
  });
}

function FlightBoxes({ flight }: { flight: Disc["flight"] }) {
  return (
    <div className="mt-3 flex gap-1.5">
      {[
        { label: "S", value: flight.speed },
        { label: "G", value: flight.glide },
        { label: "T", value: flight.turn },
        { label: "F", value: flight.fade },
      ].map(({ label, value }) => (
        <div key={label} className="flex-1 rounded-lg bg-[#f5f5f3] py-1.5 text-center">
          <div className="text-[9px] tracking-wider text-[#999]">{label}</div>
          <div className="text-sm font-semibold text-[#1a1a1a]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function BrandHeroLogo({ slug, brand }: { slug: string; brand: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const ext = BRAND_LOGO_EXT[slug] ?? "png";
  const height = BRAND_LOGO_LARGE.has(slug) ? 56 : 40;
  const maxWidth = BRAND_LOGO_LARGE.has(slug) ? 180 : 140;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/brands/${slug}.${ext}`}
      alt={brand}
      onError={() => setFailed(true)}
      style={{ height, width: "auto", maxWidth, objectFit: "contain" }}
    />
  );
}

export default function BrandPageClient({
  brand,
  slug,
  discs,
}: {
  brand: string;
  slug: string;
  discs: Disc[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    let list = discs;
    if (typeFilter === "distance") list = list.filter((d) => d.type === "driver" && d.flight.speed >= 10);
    else if (typeFilter === "fairway") list = list.filter((d) => d.type === "driver" && d.flight.speed < 10);
    else if (typeFilter === "midrange") list = list.filter((d) => d.type === "midrange");
    else if (typeFilter === "putter") list = list.filter((d) => d.type === "putter");
    return sortDiscs(list);
  }, [discs, typeFilter]);

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#1E3D2F] shadow-sm">
        <div className="relative flex w-full items-center px-4 py-2 md:px-8 md:py-4">
          <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-85" style={{ gap: 8 }}>
            <Image src="/discdrop-logo-dark.svg" alt="DiscDrop" width={170} height={36} className="h-[28px] w-auto md:h-[36px]" />
          </Link>
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-[#9DC08B] md:flex">
            <Link href="/" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Hjem</Link>
            <a href="/#hot-drops" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Hot Drops</a>
            <Link href="/browse" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Alle disker</Link>
            <Link href="/bag/build" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Bygg min bag</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="w-full bg-[#1E3D2F] px-4 pb-8 pt-6 sm:px-8 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-1 text-xs text-[#9DC08B]">
            <Link href="/browse" className="transition-colors hover:text-white">Alle disker</Link>
            <span className="mx-1.5 opacity-40">/</span>
            <span className="text-white/70">{brand}</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <BrandHeroLogo slug={slug} brand={brand} />
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#F5F2EB] sm:text-4xl">
                {brand}
              </h1>
              <p className="mt-1 text-sm text-[#9DC08B]">
                {discs.length} disk{discs.length !== 1 ? "er" : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {/* Type filter pills */}
        <div className="-mx-4 flex overflow-x-auto px-4 pb-5 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex gap-2">
            {TYPE_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setTypeFilter(pill.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  typeFilter === pill.id
                    ? "bg-[#2D6A4F] text-white shadow-sm"
                    : "bg-white text-[#444] ring-1 ring-[#ddd] hover:ring-[#2D6A4F]/50 hover:text-[#2D6A4F]"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-[#888]">
          Viser {filtered.length} disk{filtered.length !== 1 ? "er" : ""}
          {typeFilter !== "all" && ` · ${TYPE_PILLS.find((p) => p.id === typeFilter)?.label}`}
        </p>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((d) => {
            const price = getScrapedPrice(d.id).price;
            const unavailable = price === null;
            return (
              <Link
                key={d.id}
                href={`/disc/${d.id}`}
                className={`rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  unavailable ? "border-[#ece9e1] opacity-60" : "border-[#e8e8e4]"
                }`}
              >
                <div
                  className="relative mb-3 flex items-center justify-center rounded-xl bg-[#F5F2EB]"
                  style={{ height: 100 }}
                >
                  <DiscImage
                    src={getDiscImage(d)}
                    name={d.name}
                    brand={d.brand}
                    type={d.type}
                    containerStyle={{ height: 100 }}
                  />
                  {(d.tags as string[]).some((t) => BADGE_STYLES[t]) && (
                    <div className="absolute left-2 top-2 flex flex-col gap-1">
                      {(d.tags as string[])
                        .filter((t) => BADGE_STYLES[t])
                        .slice(0, 2)
                        .map((tag) => {
                          const s = BADGE_STYLES[tag];
                          return (
                            <span
                              key={tag}
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                              style={{ background: s.bg, color: s.text }}
                            >
                              {s.label}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-base font-semibold text-[#1a1a1a]">{d.name}</h3>
                    <p className="truncate text-xs text-[#666]">{d.brand}</p>
                  </div>
                  <span className="ml-1 shrink-0 rounded bg-[#f0f0ee] px-1.5 py-0.5 text-[10px] text-[#666]">
                    {TYPE_LABEL[d.type] ?? d.type}
                  </span>
                </div>
                <FlightBoxes flight={d.flight} />
                <div className="mt-3 border-t border-[#f0ede6] pt-3">
                  {unavailable ? (
                    <span className="inline-flex items-center rounded-full bg-[#f0ede6] px-2.5 py-1 text-xs font-medium text-[#aaa]">
                      Ikke i butikk
                    </span>
                  ) : (
                    <>
                      <p className="font-serif text-lg font-semibold text-[#2D6A4F]">fra kr {price}</p>
                      {getScrapedPrice(d.id).inStockCount > 0 && (
                        <p className="text-xs text-[#888]">
                          {getScrapedPrice(d.id).inStockCount} butikk{getScrapedPrice(d.id).inStockCount === 1 ? "" : "er"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="mt-16 border-t border-[#e0ddd4] bg-[#F5F2EB] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[#999]">
          <span>© 2026 DiscDrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#444]">Personvern</Link>
            <Link href="/kontakt" className="transition-colors hover:text-[#444]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#444]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
