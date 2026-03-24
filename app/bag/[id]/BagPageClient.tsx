"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DiscImage } from "@/components/DiscImage";

// ── Types ──────────────────────────────────────────────────────────────────

export type GeneratedDisc = {
  id: string;
  name: string;
  brand: string;
  type: string;
  flight: { speed: number; glide: number; turn: number; fade: number };
  image?: string;
  category: "driver" | "fairway" | "midrange" | "putter";
  quantity: 1 | 2;
  reason: string;
  priceNOK?: number;
};

export type WizardAnswers = {
  skillLevel: "beginner" | "intermediate" | "advanced" | "pro";
  armSpeed: "slow" | "medium" | "fast";
  discTypes: string[];
  budget: string;
  ownedDiscs: string;
  courseTypes: string[];
};

export type StoredBag = {
  answers: WizardAnswers;
  discs: GeneratedDisc[];
  generatedAt: number;
};

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_ORDER: GeneratedDisc["category"][] = ["driver", "fairway", "midrange", "putter"];

const CATEGORY_LABELS: Record<GeneratedDisc["category"], string> = {
  driver: "Distance Drivers",
  fairway: "Fairway Drivers",
  midrange: "Midrange",
  putter: "Putters",
};

const CATEGORY_COLORS: Record<GeneratedDisc["category"], string> = {
  driver: "#E8704A",
  fairway: "#F5A623",
  midrange: "#2D6A4F",
  putter: "#3B82F6",
};

const SKILL_LABELS: Record<WizardAnswers["skillLevel"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro / Elite",
};

const ARM_LABELS: Record<WizardAnswers["armSpeed"], string> = {
  slow: "Slow arm",
  medium: "Medium arm",
  fast: "Fast arm",
};

const BAG_GEAR = [
  {
    name: "GRIP EQ BX3",
    brand: "GRIP Equipment",
    desc: "15L backpack built for competitive play. Holds 18+ discs with ergonomic harness.",
    price: "kr 1 099",
    url: "#",
  },
  {
    name: "Terrex Swift R3",
    brand: "Adidas",
    desc: "Trail shoes with superior grip on wet grass and soft ground. Game changer on dewy mornings.",
    price: "kr 1 299",
    url: "#",
  },
  {
    name: "Bag Wax",
    brand: "GRIP EQ",
    desc: "All-weather disc grip enhancer. A small puck that keeps grip consistent in any conditions.",
    price: "kr 149",
    url: "#",
  },
];

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4">
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
      <div className="hidden items-center gap-8 text-sm text-[#444] md:flex">
        <Link href="/" className="transition-colors hover:text-[#1a1a1a]">Home</Link>
        <Link href="/" className="transition-colors hover:text-[#1a1a1a]">Hot Drops</Link>
        <Link href="/" className="transition-colors hover:text-[#1a1a1a]">Browse</Link>
        <Link
          href="/bag/build"
          className="flex items-center gap-1.5 rounded-full bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#B8E04A] transition-all hover:brightness-110"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Build My Bag
        </Link>
      </div>
    </nav>
  );
}

// ── Reason tooltip ──────────────────────────────────────────────────────────

function ReasonTooltip({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8e8e4] text-xs text-[#888] transition-colors hover:bg-[#2D6A4F] hover:text-white"
        aria-label="Why this disc"
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-xl border border-[#e8e8e4] bg-white p-3 shadow-lg">
          <p className="text-xs leading-relaxed text-[#444]">{reason}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 text-[#aaa] hover:text-[#666]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ── Disc card ──────────────────────────────────────────────────────────────

function DiscCard({ disc }: { disc: GeneratedDisc }) {
  const f = disc.flight;
  return (
    <Link
      href={`/disc/${disc.id}`}
      className="group relative flex flex-col rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2D6A4F]/30 hover:shadow-md"
    >
      {disc.quantity === 2 && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-[#1E3D2F] px-2 py-0.5 text-[10px] font-semibold text-[#B8E04A]">
          ×2 rotation
        </span>
      )}

      {disc.image && (
        <div className="mb-3 flex items-center justify-center rounded-xl bg-[#F5F2EB]" style={{ height: 96 }}>
          <DiscImage src={disc.image} name={disc.name} brand={disc.brand} containerStyle={{ height: 96 }} />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-base font-semibold text-[#1a1a1a]">{disc.name}</h3>
          <p className="text-xs text-[#888]">{disc.brand}</p>
        </div>
        <div
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          role="none"
        >
          <ReasonTooltip reason={disc.reason} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[
          { label: "SPD", value: f.speed },
          { label: "GLI", value: f.glide },
          { label: "TRN", value: f.turn },
          { label: "FAD", value: f.fade },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-[#f0f0ee] px-1.5 py-1.5 text-center">
            <div className="text-[9px] tracking-wider text-[#999]">{label}</div>
            <div className="text-sm font-semibold text-[#1a1a1a]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e8e8e4] pt-3">
        {disc.priceNOK != null ? (
          <span className="font-serif text-lg font-semibold text-[#2D6A4F]">
            {disc.priceNOK} kr
          </span>
        ) : (
          <span className="text-sm text-[#aaa]">—</span>
        )}
        <span className="text-xs text-[#2D6A4F]">Find best price →</span>
      </div>
    </Link>
  );
}

// ── Flight coverage chart ──────────────────────────────────────────────────

function FlightCoverageChart({ discs }: { discs: GeneratedDisc[] }) {
  const W = 480, H = 300;
  const padL = 48, padR = 24, padT = 28, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xMin = -3, xMax = 7;
  const yMin = 0, yMax = 14;

  function xPos(stability: number) {
    return padL + ((stability - xMin) / (xMax - xMin)) * chartW;
  }
  function yPos(speed: number) {
    return padT + chartH - ((speed - yMin) / (yMax - yMin)) * chartH;
  }

  const xTicks = [-2, 0, 2, 4, 6];
  const yTicks = [2, 4, 6, 8, 10, 12, 14];

  const plotted = discs.map((d) => ({
    disc: d,
    stability: d.flight.fade - d.flight.turn,
    x: xPos(d.flight.fade - d.flight.turn),
    y: yPos(d.flight.speed),
    color: CATEGORY_COLORS[d.category],
  }));

  return (
    <section className="w-full bg-white px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Flight Coverage
        </h2>
        <p className="mb-6 text-sm text-[#666]">
          Your bag plotted by speed and stability. A well-rounded bag covers all zones.
        </p>

        <div className="mb-4 flex flex-wrap gap-4">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs text-[#666]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
              {CATEGORY_LABELS[cat]}
            </div>
          ))}
        </div>

        <div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} aria-label="Flight coverage chart">
            <rect width={W} height={H} fill="#fafaf8" rx="12" />
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="white" rx="4" />

            {yTicks.map((s) => {
              const y = yPos(s);
              return (
                <g key={`y-${s}`}>
                  <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e8e8e4" strokeWidth="1" />
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#bbb" fontFamily="system-ui,sans-serif">{s}</text>
                </g>
              );
            })}

            {xTicks.map((v) => {
              const x = xPos(v);
              return (
                <g key={`x-${v}`}>
                  <line
                    x1={x} y1={padT} x2={x} y2={padT + chartH}
                    stroke={v === 0 ? "#ccc" : "#e8e8e4"}
                    strokeWidth={v === 0 ? 1.5 : 1}
                    strokeDasharray={v === 0 ? undefined : "3 3"}
                  />
                  <text x={x} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="#bbb" fontFamily="system-ui,sans-serif">
                    {v > 0 ? `+${v}` : v}
                  </text>
                </g>
              );
            })}

            <text x={padL - 8} y={padT - 8} fontSize="9" fill="#bbb" fontFamily="system-ui,sans-serif">Speed</text>
            <text x={padL + chartW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#bbb" fontFamily="system-ui,sans-serif">
              Stability (understable ← 0 → overstable)
            </text>

            {plotted.map(({ disc, x, y, color }, i) => (
              <g key={`${disc.id}-${i}`}>
                <circle cx={x} cy={y} r="9" fill={color} opacity="0.8" />
                {disc.quantity === 2 && (
                  <circle cx={x + 5} cy={y - 5} r="9" fill="none" stroke={color} strokeWidth="1.5" opacity="0.45" />
                )}
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize="7" fill="white" fontFamily="system-ui,sans-serif" fontWeight="600">
                  {disc.name.slice(0, 3).toUpperCase()}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

// ── Not found ──────────────────────────────────────────────────────────────

function BagNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F2EB]">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Bag not found</h1>
        <p className="mt-3 max-w-sm text-[#666]">
          This bag link is invalid or was cleared from your browser. Build a new bag to get started.
        </p>
        <Link
          href="/bag/build"
          className="mt-6 rounded-xl bg-[#2D6A4F] px-6 py-3 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          Build My Bag →
        </Link>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function BagPageClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [bagData, setBagData] = useState<StoredBag | null | "loading">("loading");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(`discdrop_bag_${id}`);
    if (!raw) {
      setBagData(null);
      return;
    }
    try {
      setBagData(JSON.parse(raw) as StoredBag);
    } catch {
      setBagData(null);
    }
  }, [id]);

  if (bagData === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F2EB]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e8e8e4] border-t-[#2D6A4F]" />
      </div>
    );
  }

  if (bagData === null) return <BagNotFound />;

  const { answers, discs } = bagData;

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  const totalValue = discs.reduce((sum, d) => sum + (d.priceNOK ?? 0) * d.quantity, 0);
  const discCount = discs.reduce((sum, d) => sum + d.quantity, 0);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: discs.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const discTypeLabels: Record<string, string> = {
    drivers: "Drivers",
    midrange: "Mid-range",
    putters: "Putters",
    "full-bag": "Full bag",
  };

  const courseTypeLabels: Record<string, string> = {
    wooded: "Wooded",
    open: "Open field",
    mixed: "Mixed",
    all: "All types",
  };

  const budgetLabels: Record<string, string> = {
    "under-500": "Under kr 500",
    "500-1500": "kr 500–1 500",
    "1500-3000": "kr 1 500–3 000",
    "no-limit": "No limit",
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      <Navbar />

      <main>
        {/* ── Bag header ── */}
        <section className="w-full bg-[#1E3D2F] px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 text-sm text-[#9DC08B]">
              <Link href="/bag/build" className="hover:text-[#B8E04A]">Build My Bag</Link>
              {" / "}
              <span className="text-[#F5F2EB]">Your Bag</span>
            </div>

            <h1 className="font-serif text-[clamp(2rem,6vw,3.5rem)] font-semibold leading-none tracking-tight text-[#F5F2EB]">
              Your DiscDrop Bag
            </h1>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                SKILL_LABELS[answers.skillLevel],
                ARM_LABELS[answers.armSpeed],
                ...(answers.discTypes.length > 0
                  ? [answers.discTypes.map((t) => discTypeLabels[t] ?? t).join(" + ")]
                  : ["Full bag"]),
                budgetLabels[answers.budget] ?? answers.budget,
                ...(answers.courseTypes.length > 0
                  ? [answers.courseTypes.map((t) => courseTypeLabels[t] ?? t).join(" + ")]
                  : []),
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#9DC08B]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
                    Bag value
                  </div>
                  <div className="font-serif text-4xl font-bold text-[#B8E04A]">
                    {totalValue > 0 ? `kr ${totalValue.toLocaleString("nb-NO")}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
                    Discs
                  </div>
                  <div className="font-serif text-4xl font-bold text-[#F5F2EB]">{discCount}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-[#F5F2EB] transition-all hover:bg-white/20"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <Link
                  href="/bag/build"
                  className="rounded-xl bg-[#B8E04A] px-5 py-2.5 text-sm font-semibold text-[#1E3D2F] transition-all hover:brightness-110"
                >
                  Rebuild →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Disc cards ── */}
        <section className="w-full bg-white px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-6xl">
            {grouped.map(({ cat, items }) => (
              <div key={cat} className="mb-12 last:mb-0">
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
                  <h2 className="font-serif text-xl font-semibold text-[#1a1a1a]">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <span className="rounded-full bg-[#f0f0ee] px-2.5 py-0.5 text-xs text-[#666]">
                    {items.reduce((s, d) => s + d.quantity, 0)} discs
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((disc, i) => (
                    <DiscCard key={`${disc.id}-${i}`} disc={disc} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Flight coverage chart ── */}
        <FlightCoverageChart discs={discs} />

        {/* ── Rotation reminder ── */}
        <section className="w-full bg-[#1E3D2F] px-4 py-10 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 shrink-0 rounded-xl bg-white/10 p-2.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8E04A" strokeWidth="2" aria-hidden>
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#B8E04A]">
                  Rotate your discs
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9DC08B]">
                  Discs wear in over time and become more understable. Rotate new discs into your bag
                  every 6–12 months to maintain consistency. The discs marked{" "}
                  <strong className="text-[#F5F2EB]">×2 rotation</strong> are your most-thrown
                  workhorse discs — keeping a fresh backup means you always have a reliable flight.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Equipment upsell ── */}
        <section className="w-full bg-white px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                Now you need something to carry it in
              </h2>
            </div>
            <p className="mb-2 text-xs text-[#B8A87A]">
              Affiliate links — update hrefs when live
            </p>
            <p className="mb-8 text-sm text-[#666]">
              A great bag setup keeps discs organised and your game sharp on the course.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {BAG_GEAR.map((gear) => (
                <a
                  key={gear.name}
                  href={gear.url}
                  className="flex flex-col rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-5 transition-all hover:border-[#2D6A4F]/30 hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-base font-semibold text-[#1a1a1a]">
                        {gear.name}
                      </h3>
                      <p className="text-xs text-[#888]">{gear.brand}</p>
                    </div>
                    <span className="shrink-0 font-serif text-base font-semibold text-[#2D6A4F]">
                      {gear.price}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#555]">{gear.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F]">
                    View deal →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] py-8 text-center text-xs text-[#666]">
        <p>DiscDrop — price comparison for disc golf in Norway</p>
        <p className="mt-2">
          <Link href="/bag/build" className="text-[#2D6A4F] hover:underline">
            ← Start over / Build a new bag
          </Link>
        </p>
      </footer>
    </div>
  );
}
