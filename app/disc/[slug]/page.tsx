import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { discs } from "@/data/discs.js";
import { getMergedStores, scrapedLastUpdated, getScrapedPrice } from "@/lib/disc-utils";
import { DiscImage } from "@/components/DiscImage";
import {
  PriceTable,
  LandedCostCalculator,
  PriceHistoryChart,
  PriceAlertSignup,
  FlightPathChart,
} from "./DiscDetailClient";

// ── Types ───────────────────────────────────────────────────────────────────

type Disc = (typeof discs)[number];

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  driver: "Distance Driver",
  midrange: "Midrange",
  putter: "Putter",
};

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#E8704A", text: "#fff", label: "HOT" },
  new: { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "BEGRENSET" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
  "sold-out": { bg: "#888", text: "#fff", label: "UTSOLGT" },
  upcoming: { bg: "#3B82F6", text: "#fff", label: "KOMMENDE" },
};

// ── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 relative flex w-full items-center bg-[#F5F2EB] px-8 py-4 shadow-sm">
      <Link
        href="/"
        className="flex shrink-0 items-center transition-opacity hover:opacity-85"
        style={{ gap: 10 }}
      >
        <Image src="/logo.svg" alt="DiscDrop" width={84} height={90} style={{ borderRadius: 4 }} />
        <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
          <span style={{ color: "#2D6A4F" }}>Disc</span>
          <span style={{ color: "#B8E04A" }}>Drop</span>
        </span>
      </Link>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-[#444] md:flex">
        <Link href="/" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-[rgba(45,106,79,0.08)] hover:text-[#1a1a1a]">
          Hjem
        </Link>
        <a href="/#hot-drops" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-[rgba(45,106,79,0.08)] hover:text-[#1a1a1a]">
          Hot Drops
        </a>
        <Link href="/browse" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-[rgba(45,106,79,0.08)] hover:text-[#1a1a1a]">
          Bla gjennom
        </Link>
        <Link href="/bag/build" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-[rgba(45,106,79,0.08)] hover:text-[#1a1a1a]">
          Bygg min bag
        </Link>
      </div>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ disc }: { disc: Disc }) {
  const bestPrice = getScrapedPrice(disc.id).price;
  const tags = disc.tags as string[];
  const player = "player" in disc ? disc.player : undefined;

  const flight = disc.flight;
  const flightCells = [
    { label: "Speed", value: flight.speed },
    { label: "Glide", value: flight.glide },
    { label: "Turn", value: flight.turn },
    { label: "Fade", value: flight.fade },
  ];

  return (
    <section className="w-full bg-[#1E3D2F] px-4 py-14 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-[#9DC08B]">
          <Link href="/" className="transition-colors hover:text-[#B8E04A]">
            DiscDrop
          </Link>
          <span className="opacity-40">/</span>
          <Link
            href={
              disc.type === "driver"
                ? disc.flight.speed >= 10 ? "/browse?type=distance" : "/browse?type=fairway"
                : `/browse?type=${disc.type}`
            }
            className="transition-colors hover:text-[#B8E04A]"
          >
            {disc.type === "driver"
              ? disc.flight.speed >= 10 ? "Distance Drivers" : "Fairway Drivers"
              : (TYPE_LABELS[disc.type] ?? disc.type) + "s"}
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-[#F5F2EB]">{disc.name}</span>
        </div>

        {/* Badges */}
        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const style = BADGE_STYLES[tag];
              return (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
                  style={
                    style
                      ? { background: style.bg, color: style.text }
                      : { background: "#555", color: "#fff" }
                  }
                >
                  {style?.label ?? tag.toUpperCase()}
                </span>
              );
            })}
          </div>
        )}

        {/* Title */}
        <h1 className="font-serif text-[clamp(2.5rem,7vw,4rem)] font-semibold leading-none tracking-tight text-[#F5F2EB]">
          {disc.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-lg text-[#9DC08B]">{disc.brand}</span>
          <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-[#B8E04A]">
            {TYPE_LABELS[disc.type] ?? disc.type}
          </span>
          {player && (
            <span className="text-sm text-[#9DC08B]">
              {player}
            </span>
          )}
        </div>

        {/* Flight numbers + disc image */}
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="grid flex-1 grid-cols-4 gap-3 sm:gap-4">
            {flightCells.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl bg-white/8 border border-white/10 px-3 py-4 text-center backdrop-blur-sm"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9DC08B]">
                  {label}
                </div>
                <div className="mt-1 font-serif text-4xl font-bold text-[#F5F2EB]">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-center self-center rounded-2xl bg-white/8 border border-white/10 p-4 sm:w-52" style={{ height: 180 }}>
            <DiscImage
              src={"image" in disc ? (disc.image as string) : ""}
              name={disc.name}
              brand={disc.brand}
              type={disc.type}
              containerStyle={{ height: 180 }}
            />
          </div>
        </div>

        {/* Best price */}
        <div className="mt-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
            Beste pris
          </div>
          {bestPrice != null ? (
            <div className="font-serif text-[2.5rem] font-bold leading-none text-[#B8E04A]">
              kr {bestPrice}
            </div>
          ) : (
            <div className="text-lg text-[#9DC08B]">Ikke tilgjengelig</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return discs.map((d) => ({ slug: d.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const disc = discs.find((d) => d.id === slug);
  if (!disc) return {};
  const storeCount = getScrapedPrice(disc.id).storeCount;
  return {
    title: `${disc.name} — Beste pris i Norge | DiscDrop`,
    description: `Finn beste pris på ${disc.name} fra ${disc.brand}. Sammenlign ${storeCount} norske butikker inkludert frakt og MVA.`,
  };
}

export default async function DiscDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const disc = discs.find((d) => d.id === slug);

  if (!disc) notFound();

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      <Navbar />
      <div className="bg-[#F5F2EB] px-8 py-3">
        <Link
          href="/browse"
          className="inline-flex items-center gap-1.5 text-sm text-[#9DC08B] transition-colors hover:text-[#2D6A4F]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Tilbake til søk
        </Link>
      </div>
      <main>
        <Hero disc={disc} />
        <FlightPathChart flight={disc.flight} />
        <PriceTable stores={getMergedStores(disc)} lastUpdated={scrapedLastUpdated} />
        <LandedCostCalculator />
        <PriceHistoryChart priceHistory={disc.priceHistory} />
        <PriceAlertSignup discName={disc.name} />
      </main>
      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] py-8 text-center text-xs text-[#666]">
        <p>DiscDrop — price comparison for disc golf in Norway</p>
      </footer>
    </div>
  );
}
