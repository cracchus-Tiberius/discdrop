import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discs } from "@/data/discs.js";
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
  new: { bg: "#4CAF82", text: "#fff", label: "NEW DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NEW DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "LIMITED" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
  "sold-out": { bg: "#888", text: "#fff", label: "SOLD OUT" },
  upcoming: { bg: "#3B82F6", text: "#fff", label: "UPCOMING" },
};

function bestPriceNOK(disc: Disc): number | null {
  const inStock = disc.stores.filter((s) => s.inStock);
  const pool = inStock.length ? inStock : disc.stores;
  const prices = pool.map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
}

// ── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 text-[#1a1a1a] transition-opacity hover:opacity-85"
      >
        <svg width="28" height="28" viewBox="0 0 44 44" fill="none" aria-hidden>
          <circle cx="22" cy="22" r="20" stroke="#2D6A4F" strokeWidth="1.5" opacity="0.4" />
          <circle cx="22" cy="22" r="13" stroke="#2D6A4F" strokeWidth="1.5" />
          <ellipse cx="22" cy="22" rx="20" ry="6" stroke="#2D6A4F" strokeWidth="1" opacity="0.5" />
          <circle cx="22" cy="22" r="3.5" fill="#2D6A4F" />
        </svg>
        <span className="text-lg font-semibold tracking-tight">DiscDrop</span>
      </Link>
      <div className="hidden items-center gap-8 text-sm text-[#444] md:flex">
        <Link href="/" className="transition-colors hover:text-[#1a1a1a]">
          Home
        </Link>
        <a href="#" className="transition-colors hover:text-[#1a1a1a]">
          Hot Drops
        </a>
        <a href="#" className="transition-colors hover:text-[#1a1a1a]">
          Browse
        </a>
        <Link
          href="/bag/build"
          className="font-medium text-[#2D6A4F] transition-colors hover:text-[#1E4D3A]"
        >
          Build My Bag
        </Link>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-[#2D6A4F] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.02] hover:brightness-110"
      >
        Find a disc
      </Link>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ disc }: { disc: Disc }) {
  const bestPrice = bestPriceNOK(disc);
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
          <Link href="/" className="transition-colors hover:text-[#B8E04A]">
            {TYPE_LABELS[disc.type] ?? disc.type}s
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
          {"image" in disc && disc.image && (
            <div className="flex shrink-0 items-center justify-center self-center rounded-2xl bg-white/8 border border-white/10 p-4 sm:w-52">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={disc.image as string}
                alt={disc.name}
                style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        {/* Best price + back link */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
              Best price
            </div>
            {bestPrice != null ? (
              <div className="font-serif text-[2.5rem] font-bold leading-none text-[#B8E04A]">
                kr {bestPrice}
              </div>
            ) : (
              <div className="text-lg text-[#9DC08B]">Not available</div>
            )}
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-[#9DC08B] transition-all hover:border-white/30 hover:text-[#F5F2EB]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to search
          </Link>
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
  const storeCount = disc.stores.filter((s) => s.inStock).length;
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
      <main>
        <Hero disc={disc} />
        <FlightPathChart flight={disc.flight} />
        <PriceTable stores={disc.stores} />
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
