"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import { SiteHeader } from "@/components/SiteHeader";
import { discs as discCatalog } from "@/data/discs.js";
import { getDiscImage } from "@/lib/disc-utils";

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
  level: "beginner" | "intermediate" | "advanced" | "pro";
  throwingStyle: "rhbh" | "lhbh" | "forehand" | "both";
  needs: string[];
  budget: string | null;
  brands: string[];
  discCount: string | null;
};

export type StoredBag = {
  answers: WizardAnswers;
  discs: GeneratedDisc[];
  generatedAt: number;
  summary?: string;
  bagTips?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_ORDER: GeneratedDisc["category"][] = ["driver", "fairway", "midrange", "putter"];

const CATEGORY_LABELS: Record<GeneratedDisc["category"], string> = {
  driver: "Distance Drivere",
  fairway: "Fairway Drivere",
  midrange: "Midrange",
  putter: "Puttere",
};

const CATEGORY_COLORS: Record<GeneratedDisc["category"], string> = {
  driver: "#E8704A",
  fairway: "#F5A623",
  midrange: "#2D6A4F",
  putter: "#3B82F6",
};

const LEVEL_LABELS: Record<WizardAnswers["level"], string> = {
  beginner: "Nybegynner",
  intermediate: "Middels",
  advanced: "Avansert",
  pro: "Pro / Elite",
};

const THROWING_LABELS: Record<WizardAnswers["throwingStyle"], string> = {
  rhbh: "RHBH",
  lhbh: "LHBH",
  forehand: "Forehand",
  both: "Begge hender",
};

const BAG_GEAR = [
  {
    name: "GRIP EQ BX3",
    brand: "GRIP Equipment",
    desc: "15L ryggsekkbag for seriøse spillere. Plass til 18+ disker med ergonomisk bæresystem.",
    price: "kr 1 099",
    url: "#",
  },
  {
    name: "Terrex Swift R3",
    brand: "Adidas",
    desc: "Tursko med utmerket grep på vått gress og mykt underlag. Gjør underverker på duggrøte morgener.",
    price: "kr 1 299",
    url: "#",
  },
  {
    name: "Bag Wax",
    brand: "GRIP EQ",
    desc: "Gripforsterker for alle forhold. En liten puck som holder grepskonsiistensen stabil uansett vær.",
    price: "kr 149",
    url: "#",
  },
];

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#E8704A", text: "#fff", label: "HOT" },
  new: { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "BEGRENSET" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
  "sold-out": { bg: "#888", text: "#fff", label: "UTSOLGT" },
};

// ── Reason tooltip ──────────────────────────────────────────────────────────

function ReasonTooltip({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1EFE6] text-xs text-[#101C1499] transition-colors hover:bg-[#101C14] hover:text-[#B8E04A]"
        aria-label="Hvorfor denne disken"
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-xl border-2 border-[#101C14] bg-white p-3 shadow-lg">
          <p className="text-xs leading-relaxed text-[#101C14]">{reason}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 text-[#101C1477] hover:text-[#101C1499]"
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
  const catalogDisc = discCatalog.find((d) => d.id === disc.id);
  const catalogTags = (catalogDisc?.tags as string[] | undefined) ?? [];
  const imageUrl = catalogDisc ? getDiscImage(catalogDisc) : "";
  return (
    <Link
      href={`/disc/${disc.id}`}
      className="group relative flex flex-col rounded-2xl border-2 border-[#101C14] bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#B8E04A]"
    >
      {disc.quantity === 2 && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-[#101C14] px-2 py-0.5 text-[10px] font-semibold text-[#B8E04A]">
          ×2 rotasjon
        </span>
      )}

      <div className="relative mb-3 flex items-center justify-center rounded-xl bg-[#FFFDF6]" style={{ height: 96 }}>
        <DiscImage src={imageUrl} name={disc.name} brand={disc.brand} type={disc.category} containerStyle={{ height: 96 }} />
        {catalogTags.some((t) => BADGE_STYLES[t]) && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {catalogTags
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

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-[#101C14]">{disc.name}</h3>
          <p className="text-xs text-[#101C1499]">{disc.brand}</p>
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
          <div key={label} className="rounded-lg bg-[#F1EFE6] px-1.5 py-1.5 text-center">
            <div className="text-[9px] tracking-wider text-[#101C1488]">{label}</div>
            <div className="text-sm font-semibold text-[#101C14]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-2 border-[#101C14] pt-3">
        {disc.priceNOK != null ? (
          <span className="text-lg font-extrabold text-[#101C14]">
            {disc.priceNOK} kr
          </span>
        ) : (
          <span className="text-sm text-[#101C1477]">—</span>
        )}
        <span className="text-xs text-[#101C14]">Finn beste pris →</span>
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
        <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[#101C14]">
          Flydekning
        </h2>
        <p className="mb-6 text-sm text-[#101C1499]">
          Baggen din plottet etter hastighet og stabilitet. En godt avrundet bag dekker alle soner.
        </p>

        <div className="mb-4 flex flex-wrap gap-4">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs text-[#101C1499]">
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
              Stabilitet (understabil ← 0 → overstabil)
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
    <div className="flex min-h-screen flex-col bg-[#FFFDF6]">
      <SiteHeader />
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-extrabold text-[#101C14]">Bag ikke funnet</h1>
        <p className="mt-3 max-w-sm text-[#101C1499]">
          Denne baglenken er ugyldig eller ble slettet fra nettleseren din. Bygg en ny bag for å komme i gang.
        </p>
        <Link
          href="/bag/build"
          className="dd-cta mt-6 px-6 py-3 text-sm"
        >
          Bygg min bag →
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF6]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F1EFE6] border-t-[#101C14]" />
      </div>
    );
  }

  if (bagData === null) return <BagNotFound />;

  const { answers, discs, summary, bagTips } = bagData;

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

  const needsLabels: Record<string, string> = {
    distance: "Mer distanse",
    precision: "Bedre presisjon",
    approach: "Sterkere innspill",
    putting: "Sikrere putting",
    wind: "Disker for vind",
    "full-bag": "Komplett bag",
  };

  const budgetLabels: Record<string, string> = {
    "under-500": "Under kr 500",
    "500-1000": "kr 500–1000",
    "1000+": "kr 1000+",
    "doesnt-matter": "Fri pris",
  };

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />

      <main>
        {/* ── Bag header ── */}
        <section className="w-full bg-[#101C14] px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 text-sm text-[#FFFDF6]/70">
              <Link href="/bag/build" className="hover:text-[#B8E04A]">Bygg min bag</Link>
              {" / "}
              <span className="text-[#FFFDF6]">Din bag</span>
            </div>

            <h1 className="text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-none tracking-tight text-[#FFFDF6]">
              Din DiscDrop-bag
            </h1>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                LEVEL_LABELS[answers.level],
                THROWING_LABELS[answers.throwingStyle],
                ...(answers.needs.length > 0
                  ? [answers.needs.map((n) => needsLabels[n] ?? n).join(", ")]
                  : []),
                ...(answers.budget ? [budgetLabels[answers.budget] ?? answers.budget] : []),
                ...(answers.discCount ? [`${answers.discCount} disker`] : []),
              ].filter(Boolean).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#FFFDF6]/70"
                >
                  {tag}
                </span>
              ))}
            </div>

            {summary && (
              <div className="mt-6 rounded-xl bg-white/10 px-5 py-4">
                <p className="text-sm leading-relaxed text-[#FFFDF6]">{summary}</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#FFFDF6]/70">
                    Bagverdi
                  </div>
                  <div className="text-4xl font-extrabold text-[#B8E04A]">
                    {totalValue > 0 ? `kr ${totalValue.toLocaleString("nb-NO")}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#FFFDF6]/70">
                    Disker
                  </div>
                  <div className="text-4xl font-extrabold text-[#FFFDF6]">{discCount}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-[#FFFDF6] transition-all hover:bg-white/20"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  {copied ? "Kopiert!" : "Kopier lenke"}
                </button>
                <Link
                  href="/bag/build"
                  className="rounded-xl border-2 border-[#101C14] bg-[#B8E04A] px-5 py-2.5 text-sm font-extrabold text-[#101C14] shadow-[3px_3px_0_#101C14] transition-transform hover:-translate-y-0.5 hover:-translate-x-0.5"
                >
                  Bygg på nytt →
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
                  <h2 className="text-xl font-extrabold text-[#101C14]">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <span className="rounded-full bg-[#F1EFE6] px-2.5 py-0.5 text-xs text-[#101C1499]">
                    {items.reduce((s, d) => s + d.quantity, 0)} disker
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
        <section className="w-full bg-[#101C14] px-4 py-10 sm:px-8">
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
                  Roter diskene dine
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#FFFDF6]/70">
                  Disker slites inn over tid og blir mer understabile. Roter inn nye disker i baggen
                  din hvert 6.–12. måned for å opprettholde konsistens. Diskene merket{" "}
                  <strong className="text-[#FFFDF6]">×2 rotasjon</strong> er dine mest brukte
                  arbeidshester — en fersk reserve sikrer at du alltid har en pålitelig flybane.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bag tip ── */}
        {bagTips && (
          <section className="w-full bg-[#FFFDF6] px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-start gap-4 rounded-2xl border-2 border-[#101C14] bg-white px-6 py-5">
                <div className="mt-0.5 shrink-0 rounded-xl bg-[#EEF7D4] p-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#101C14]">Caddie-tips</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#101C14]">{bagTips}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Equipment upsell ── */}
        <section className="w-full bg-white px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#101C14]">
                Nå trenger du noe å bære det i
              </h2>
            </div>
            <p className="mb-2 text-xs text-[#B8A87A]">
              Affiliatelenker — oppdater hrefs når live
            </p>
            <p className="mb-8 text-sm text-[#101C1499]">
              Et godt bagoppsett holder diskene organisert og spillet ditt skarpt på banen.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {BAG_GEAR.map((gear) => (
                <a
                  key={gear.name}
                  href={gear.url}
                  className="flex flex-col rounded-2xl border-2 border-[#101C14] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#B8E04A]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-[#101C14]">
                        {gear.name}
                      </h3>
                      <p className="text-xs text-[#101C1499]">{gear.brand}</p>
                    </div>
                    <span className="shrink-0 font-serif text-base font-semibold text-[#101C14]">
                      {gear.price}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#101C1499]">{gear.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#101C14]">
                    Se tilbud →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
          <span>© 2026 discdrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#FFFDF6]">Personvern</Link>
            <Link href="/kontakt" className="transition-colors hover:text-[#FFFDF6]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
