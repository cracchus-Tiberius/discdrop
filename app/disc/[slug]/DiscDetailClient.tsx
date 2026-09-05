"use client";

import { useState, useMemo, useCallback } from "react";
import { PickupBadge } from "@/components/PickupBadge";
import { plasticKey, groupPlastics, defaultPlasticKey, type PlasticGroup } from "@/lib/plastic";
import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import { entryLandedNOK, type RichStoreEntry } from "@/lib/disc-utils";
import { RelativeTime } from "@/components/RelativeTime";
import { BADGE_STYLES as BADGE_STYLES_CLIENT } from "@/lib/badge-styles";
import { PriceThresholdInput, validatePriceThreshold } from "@/components/PriceThresholdInput";

// ── Plastic normalization ────────────────────────────────────────────────────
// Scrapers sometimes emit word-swapped names (e.g. "Horizon C-Line" vs "C-Line Horizon").
// Sort words alphabetically so both map to the same canonical display name.


// ── Types ───────────────────────────────────────────────────────────────────

type Store = {
  name: string;
  storeKey: string;
  /** Shown on every row so a DX listing is never read as the same thing as Halo Star. */
  plasticLabel: string | null;
  price: number;
  inStock: boolean;
  url: string;
  shipping: number;
  freeShippingOver: number;
  country?: string;
  voec?: boolean;
};

type StoreRow = Store & {
  shippingNOK: number;
  total: number;
};

/**
 * One row per store, preferring an in-stock listing and then the cheaper one.
 * Applied WITHIN a plastic, never across them — collapsing across plastics is
 * what let a store's DX listing stand in for its Star listing.
 */
function dedupeByStore(entries: RichStoreEntry[]): RichStoreEntry[] {
  const byStore = new Map<string, RichStoreEntry>();
  for (const e of entries) {
    const existing = byStore.get(e.storeKey);
    if (!existing) {
      byStore.set(e.storeKey, e);
    } else if (e.inStock && !existing.inStock) {
      byStore.set(e.storeKey, e);
    } else if (e.inStock === existing.inStock && e.price < existing.price) {
      byStore.set(e.storeKey, e);
    }
  }
  return [...byStore.values()];
}

// ── Price Comparison Table ───────────────────────────────────────────────────

export function PriceTable({
  stores,
  lastUpdated,
  hideHeader,
  inline,
}: {
  stores: Store[];
  lastUpdated?: string | null;
  hideHeader?: boolean;
  inline?: boolean;
}) {
  /**
   * Label rows with their plastic only when the table actually mixes them.
   * A chip repeating the same word down every row is not information, and it
   * costs the width the price columns need — the Bokeh page carried eleven
   * identical "Neutron" chips, on a disc sold in one plastic, so there were no
   * chips to filter by either. Derived from the rows rather than from the
   * filter UI, which gets this wrong in exactly that case.
   */
  // Unknown plastics do not count as a distinct one. Bokeh is sold in Neutron
  // by twelve stores and unlabelled by two; counting the blank as a second
  // value kept all eleven chips on screen.
  const showPlastic = new Set(stores.map((s) => s.plasticLabel).filter(Boolean)).size > 1;

  if (stores.length === 0) {
    if (hideHeader || inline) return null;
    return (
      <section className="w-full bg-[#FFFDF6] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[#101C14]">
            Hvor kan du kjøpe
          </h2>
          <p className="mt-6 rounded-2xl border-2 border-[#101C14] bg-white px-6 py-8 text-center text-sm text-[#101C1499]">
            Ingen priser funnet ennå. Vi oppdaterer prisene daglig.
          </p>
        </div>
      </section>
    );
  }

  const rows: StoreRow[] = stores
    .map((s) => {
      // Shared with the rest of the site — see lib/disc-utils.ts's
      // entryLandedNOK() for why this isn't just "add shipping for
      // non-Norwegian stores".
      const total = entryLandedNOK(s, s);
      return { ...s, shippingNOK: total - s.price, total };
    })
    .sort((a, b) => {
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return a.total - b.total;
    });

  const bestTotal = rows.find((r) => r.inStock)?.total ?? rows[0]?.total;

  return (
    <div className={inline ? undefined : "w-full bg-[#FFFDF6] px-4 pb-10 pt-4 sm:px-8"}>
      <div className={inline ? undefined : "mx-auto max-w-4xl"}>
        {!hideHeader && (
          <>
            <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[#101C14]">
              Hvor kan du kjøpe
            </h2>
            <p className="mb-3 text-sm text-[#101C1499]">
              Sortert etter totalpris inkl. frakt.
            </p>
          </>
        )}

        {rows.length > 0 && (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border-2 border-[#101C14] bg-white md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#101C14] bg-[#F1EFE6] text-left text-xs uppercase tracking-wider text-[#101C1499]">
                    <th className={inline ? "px-3 py-2" : "px-5 py-3"}>Butikk</th>
                    {!inline && <th className="px-4 py-3">Lager</th>}
                    <th className={inline ? "px-3 py-2" : "px-4 py-3"}>Diskpris</th>
                    <th className={inline ? "px-3 py-2" : "px-4 py-3"}>Frakt</th>
                    <th className={`font-extrabold text-[#101C14] ${inline ? "px-3 py-2" : "px-4 py-3"}`}>Total</th>
                    <th className={inline ? "px-2 py-2" : "px-4 py-3"}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isBest = row.total === bestTotal && row.inStock;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-[#F1EFE6] last:border-0 transition-colors ${
                          isBest ? "bg-[#EEF7D4]" : "hover:bg-[#F1EFE6]"
                        } ${!row.inStock && inline ? "opacity-60" : ""}`}
                      >
                        <td className={`${inline ? "px-3 py-2" : "px-5 py-4"} min-w-0`}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#101C14]">{row.name}</span>
                            {row.country === "SE" && <span className="rounded bg-[#F1EFE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#101C1499]" title="Svensk butikk">SE</span>}
                            {isBest && (
                              <span className="dd-sticker text-[10px]">
                                Beste pris
                              </span>
                            )}
                            {inline && !row.inStock && (
                              <span className="text-[11px] text-[#E8704A]">Utsolgt</span>
                            )}
                            {/* Plastic first: it is what makes the row
                                comparable at all. Pickup is a nice-to-know. */}
                            {showPlastic && row.plasticLabel && (
                              <span className="rounded bg-[#F1EFE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#101C1499]">
                                {row.plasticLabel}
                              </span>
                            )}
                            <PickupBadge storeKey={row.storeKey} />
                          </div>
                          {row.country === "SE" && row.voec && !inline && (
                            <div className="mt-0.5 text-[11px] text-[#101C1499]">inkl. frakt og MVA</div>
                          )}
                        </td>
                        {!inline && (
                          <td className="px-4 py-4">
                            <StockDot inStock={row.inStock} />
                          </td>
                        )}
                        {/* Price columns never wrap. "kr 228" breaking across
                            two lines is worse than a truncated store name, so
                            any width shortfall is taken from the store column,
                            which has text that can shorten gracefully. */}
                        <td className={`${inline ? "px-3 py-2" : "px-4 py-4"} whitespace-nowrap text-[#101C14]`}>kr {row.price}</td>
                        <td className={`${inline ? "px-3 py-2" : "px-4 py-4"} whitespace-nowrap text-[#101C14]`}>
                          {row.shippingNOK > 0 ? (
                            `kr ${row.shippingNOK}`
                          ) : (
                            <span className="font-semibold text-[#101C14]">Gratis</span>
                          )}
                        </td>
                        <td className={`${inline ? "px-3 py-2" : "px-4 py-4"} whitespace-nowrap`}>
                          <span className="font-extrabold text-[#101C14]">kr {row.total}</span>
                        </td>
                        <td className={inline ? "px-2 py-2" : "px-4 py-4"}>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener"
                            className={`dd-cta text-xs ${inline ? "px-3 py-1.5" : "px-4 py-2"}`}
                          >
                            {inline ? "Kjøp" : "Gå til butikk"}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {rows.map((row, i) => {
                const isBest = row.total === bestTotal && row.inStock;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border-2 p-4 ${
                      isBest ? "border-[#101C14] bg-[#EEF7D4] shadow-[3px_3px_0_#101C14]" : "border-[#101C14] bg-white"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-[#101C14]">{row.name}</span>
                          {row.country === "SE" && <span className="rounded bg-[#F1EFE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#101C1499]" title="Svensk butikk">SE</span>}
                          {showPlastic && row.plasticLabel && (
                            <span className="rounded bg-[#F1EFE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#101C1499]">
                              {row.plasticLabel}
                            </span>
                          )}
                          <PickupBadge storeKey={row.storeKey} />
                          {isBest && (
                            <span className="dd-sticker text-[10px]">
                              Beste pris
                            </span>
                          )}
                        </div>
                        {row.country === "SE" && row.voec && (
                          <div className="mt-0.5 text-[11px] text-[#101C1499]">inkl. frakt og MVA</div>
                        )}
                      </div>
                      <StockDot inStock={row.inStock} />
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-xs text-[#101C1499]">
                      <div>
                        <div className="uppercase tracking-wider">Diskpris</div>
                        <div className="font-semibold text-[#101C14]">kr {row.price}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wider">Frakt</div>
                        <div className="font-semibold text-[#101C14]">
                          {row.shippingNOK > 0 ? `kr ${row.shippingNOK}` : "Gratis"}
                        </div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wider">Total</div>
                        <div className="font-extrabold text-[#101C14]">kr {row.total}</div>
                      </div>
                    </div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener"
                      className="dd-cta block w-full py-2.5 text-center text-sm"
                    >
                      Gå til butikk
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-[#101C1499]">
          Prisene inkluderer 25% MVA. Fraktgrenser varierer per butikk.
        </p>
      </div>
    </div>
  );
}

function StockDot({ inStock }: { inStock: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          inStock ? "bg-[#4CAF82]" : "bg-[#E8704A]"
        }`}
      />
      <span className="text-xs text-[#101C1499]">{inStock ? "På lager" : "Utsolgt"}</span>
    </div>
  );
}

type FlightNumbers = { speed: number; glide: number; turn: number; fade: number };

// ── Flight Path SVG (inline, no section wrapper) ─────────────────────────────

function FlightPathSVG({ flight }: { flight: FlightNumbers }) {
  const [isForehand, setIsForehand] = useState(false);

  const W = 340, H = 440;
  const padL = 52, padR = 12, padT = 28, padB = 20;
  const chartW = W - padL - padR;
  const chartH = 300;
  const cx = padL + chartW / 2;
  const baseY = padT + chartH;
  const scale = 2.0;
  const dir = isForehand ? -1 : 1;

  const baseM = 25 + flight.speed * 6 + flight.glide * 8;

  const arms = [
    { id: "slow",   label: "Sakte",   sub: "< 60 km/h",  color: "#4CAF82", distF: 0.78, turnF: 0.15, fadeF: 0.75 },
    { id: "medium", label: "Medium",  sub: "60–80 km/h", color: "#E8A838", distF: 0.92, turnF: 0.60, fadeF: 0.90 },
    { id: "fast",   label: "Rask",    sub: "80+ km/h",   color: "#E8704A", distF: 1.00, turnF: 1.00, fadeF: 1.00 },
  ] as const;

  function calcCurve(arm: (typeof arms)[number]) {
    const distM = Math.min(baseM * arm.distF, 150);
    const turnM  = dir * (-flight.turn * 7 * arm.turnF);
    const fadeM  = dir * (-flight.fade * 5 * arm.fadeF);
    const endLat = turnM + fadeM;
    const peakTurn = turnM * 1.5;
    const p0x = cx, p0y = baseY;
    const p1x = cx, p1y = baseY - distM * scale * 0.35;
    const p2x = cx + peakTurn * scale, p2y = baseY - distM * scale * 0.65;
    const p3x = cx + endLat * scale,   p3y = baseY - distM * scale;
    return { d: `M ${p0x} ${p0y} C ${p1x} ${p1y} ${p2x} ${p2y} ${p3x} ${p3y}`, endX: p3x, endY: p3y };
  }

  const yTicks = [50, 100, 150];
  const xTicks = [-60, -40, -20, 0, 20, 40, 60];
  const legendY = baseY + padB + 22;
  const legendItemW = chartW / 3;

  // Corner labels flip with throw direction
  const leftLabel  = isForehand ? "← Turn" : "← Fade";
  const rightLabel = isForehand ? "Fade →" : "Turn →";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Toggle */}
      <div className="flex rounded-full bg-[#F1EFE6] p-0.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setIsForehand(false)}
          className={`rounded-full px-3 py-1 transition-colors ${!isForehand ? "bg-[#101C14] text-[#B8E04A]" : "text-[#101C1499] hover:text-[#101C14]"}`}
        >
          BH
        </button>
        <button
          type="button"
          onClick={() => setIsForehand(true)}
          className={`rounded-full px-3 py-1 transition-colors ${isForehand ? "bg-[#101C14] text-[#B8E04A]" : "text-[#101C1499] hover:text-[#101C14]"}`}
        >
          FH
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 340, width: "100%" }} aria-label="Disc flight path chart">
        <rect width={W} height={H} fill="#FFFDF6" rx="12" stroke="#101C14" strokeWidth="2" />
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="white" rx="6" stroke="#101C14" strokeWidth="1.5" />
        {yTicks.map((m) => {
          const y = baseY - m * scale;
          return (
            <g key={`y-${m}`}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#101C14" strokeWidth="0.5" strokeOpacity="0.15" />
              <text x={padL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#101C14" fontFamily="system-ui,sans-serif" opacity="0.6">{m}m</text>
            </g>
          );
        })}
        <text x={padL - 5} y={baseY + 4} textAnchor="end" fontSize="9" fill="#101C14" fontFamily="system-ui,sans-serif" opacity="0.6">0m</text>
        {xTicks.map((m) => {
          const x = cx + m * scale;
          const isCenter = m === 0;
          return (
            <g key={`x-${m}`}>
              <line x1={x} y1={padT} x2={x} y2={baseY} stroke="#101C14"
                strokeWidth={isCenter ? 1.0 : 0.5} strokeOpacity={isCenter ? 0.3 : 0.1}
                strokeDasharray={isCenter ? undefined : "3 3"} />
            </g>
          );
        })}
        <text x={padL + 5} y={padT + 15} fontSize="8" fill="#101C14" fontFamily="system-ui,sans-serif" opacity="0.5">{leftLabel}</text>
        <text x={padL + chartW - 5} y={padT + 15} fontSize="8" fill="#101C14" fontFamily="system-ui,sans-serif" opacity="0.5" textAnchor="end">{rightLabel}</text>
        {arms.map((arm) => {
          const { d, endX, endY } = calcCurve(arm);
          return (
            <g key={arm.id}>
              <path d={d} fill="none" stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={endX} cy={endY} r="3.5" fill={arm.color} />
            </g>
          );
        })}
        <circle cx={cx} cy={baseY} r="5" fill="#101C14" opacity="0.15" />
        <circle cx={cx} cy={baseY} r="3" fill="#101C14" />
        <circle cx={cx} cy={baseY} r="1.5" fill="#FFFDF6" />
        {arms.map((arm, i) => {
          const lx = padL + i * legendItemW + 6;
          const ly = legendY;
          return (
            <g key={`legend-${arm.id}`}>
              <line x1={lx} y1={ly + 5} x2={lx + 18} y2={ly + 5} stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={lx + 18} cy={ly + 5} r="3" fill={arm.color} />
              <text x={lx + 25} y={ly + 9} fontSize="9" fill="#101C14" fontFamily="system-ui,sans-serif" fontWeight="700">{arm.label}</text>
              <text x={lx + 25} y={ly + 21} fontSize="8" fill="#101C1499" fontFamily="system-ui,sans-serif">{arm.sub}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Variant Price Section ────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dd-selectable shrink-0 rounded-full bg-[#F1EFE6] px-4 py-2.5 text-sm font-semibold text-[#101C14] min-h-[44px] ${
        active ? "dd-active" : ""
      }`}
    >
      {label}
    </button>
  );
}

// ── Brand logo helpers ───────────────────────────────────────────────────────

const BRAND_SLUG: Record<string, string> = {
  "Kastaplast": "kastaplast",
  "Innova": "innova",
  "Discraft": "discraft",
  "Discmania": "discmania",
  "Latitude 64": "latitude-64",
  "Dynamic Discs": "dynamic-discs",
  "Westside Discs": "westside-discs",
  "MVP Disc Sports": "mvp",
  "MVP": "mvp",
  "Axiom Discs": "axiom",
  "Axiom": "axiom",
  "Streamline Discs": "streamline",
  "Streamline": "streamline",
  "Prodigy": "prodigy",
  "Viking Discs": "viking-discs",
  "RPM Discs": "rpm",
  "Thought Space Athletics": "thought-space-athletics",
  "Alfa": "alfa",
  "EggShell Discs": "eggshell-discs",
  "Clash Discs": "clash-discs",
  "Prodiscus": "prodiscus",
  "Lone Star Discs": "lone-star-discs",
  "Gateway": "gateway",
  "Millennium": "millennium",
};

const BRAND_EXT: Record<string, string> = {
  "mvp": "svg",
  "axiom": "svg",
  "streamline": "svg",
  "westside-discs": "avif",
  "dynamic-discs": "svg",
};

function BrandLogo({ brand }: { brand: string }) {
  const [failed, setFailed] = useState(false);
  const slug = BRAND_SLUG[brand];
  if (!slug || failed) return null;
  const ext = BRAND_EXT[slug] ?? "png";
  const jpgSlugs = new Set(["latitude-64", "discmania"]);
  const filename = jpgSlugs.has(slug) ? `${slug}.jpg` : `${slug}.${ext}`;
  const large = new Set(["mvp", "axiom", "streamline"]);
  const height = large.has(slug) ? 79 : 53;
  const maxWidth = large.has(slug) ? 225 : 150;
  return (
    <img
      src={`/images/brands/${filename}`}
      alt={brand}
      onError={() => setFailed(true)}
      style={{ height, width: "auto", maxWidth, objectFit: "contain", flexShrink: 0 }}
    />
  );
}

// ── Disc Hero Section ────────────────────────────────────────────────────────

const TYPE_LABELS_CLIENT: Record<string, string> = {
  distance: "Distance Driver",
  fairway: "Fairway Driver",
  midrange: "Midrange",
  putter: "Putter",
};

type DiscInfo = {
  name: string;
  brand: string;
  type: string;
  player?: string;
  tags: string[];
  flight: { speed: number; glide: number; turn: number; fade: number };
  image: string;
};

export function DiscHeroSection({
  disc,
  discId,
  allEntries,
  lastUpdated,
  description,
}: {
  disc: DiscInfo;
  discId: string;
  allEntries: RichStoreEntry[];
  lastUpdated?: string | null;
  description?: string | null;
}) {
  // ── Chip state ──────────────────────────────────────────────────────────────

  const plasticGroups: PlasticGroup[] = useMemo(() => groupPlastics(allEntries), [allEntries]);
  const plasticLabelByKey = useMemo(
    () => new Map(plasticGroups.map((g) => [g.key, g.label])),
    [plasticGroups]
  );
  /** Distinct stores with any listing at all — the honest coverage headline. */
  const totalStoreCount = useMemo(
    () => new Set(allEntries.map((e) => e.storeKey)).size,
    [allEntries]
  );

  const showPlasticChips = plasticGroups.length >= 2;

  // Opens on the widest-stocked plastic rather than "Alle". "Alle" mixed five
  // different products into one ranking — a DX Valkyrie at 125 kr headlining
  // over Star and Champion listings elsewhere — which is the bug this fixes.
  // The store count that "Alle" used to protect is still shown, on its chip
  // and beside the selection, so coverage is visible without being claimed
  // dishonestly.
  const defaultPlastic = useMemo(
    () => (showPlasticChips ? defaultPlasticKey(plasticGroups) : null),
    [plasticGroups, showPlasticChips]
  );
  const [selectedPlastic, setSelectedPlastic] = useState<string | null>(defaultPlastic);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);

  const plasticEntries = useMemo(
    () => (!showPlasticChips || selectedPlastic === null)
      ? allEntries
      : allEntries.filter((e) => e.plastic && plasticKey(e.plastic) === selectedPlastic),
    [allEntries, selectedPlastic, showPlasticChips]
  );

  const editions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of plasticEntries) {
      if (e.edition && !seen.has(e.edition)) { seen.add(e.edition); out.push(e.edition); }
    }
    return out;
  }, [plasticEntries]);

  const showEditionChips = editions.length >= 1;

  const filtered = useMemo(
    () => selectedEdition ? plasticEntries.filter((e) => e.edition === selectedEdition) : plasticEntries,
    [plasticEntries, selectedEdition]
  );

  // ── Derived values ──────────────────────────────────────────────────────────

  // Deduplicate by store: one row per store, keeping cheapest in-stock entry
  // (or cheapest overall if no in-stock). This correctly counts 1 store even
  // when "Alle" is selected and that store carries multiple plastics/editions.
  const deduplicatedEntries = useMemo(() => dedupeByStore(filtered), [filtered]);

  const toStoreRow = useCallback((e: RichStoreEntry): Store => ({
    name: e.storeName,
    storeKey: e.storeKey,
    plasticLabel: e.plastic ? (plasticLabelByKey.get(plasticKey(e.plastic)) ?? e.plastic) : null,
    price: e.price,
    inStock: e.inStock,
    url: e.url,
    shipping: e.shipping,
    freeShippingOver: e.freeShippingOver,
    country: e.country,
    voec: e.voec,
  }), [plasticLabelByKey]);

  const storeRows: Store[] = deduplicatedEntries.map(toStoreRow);

  /**
   * "Alle" renders one table per plastic instead of one merged ranking. Merging
   * them is what produced the original complaint: a DX row and a Halo Star row
   * sorted against each other as if they were the same purchase. Grouped, the
   * page still shows everything, but every comparison inside a table is
   * like-for-like.
   */
  const groupedRows = useMemo(() => {
    if (selectedPlastic !== null || !showPlasticChips) return null;
    const byPlastic = new Map<string, RichStoreEntry[]>();
    for (const e of filtered) {
      const key = e.plastic ? plasticKey(e.plastic) : "";
      if (!byPlastic.has(key)) byPlastic.set(key, []);
      byPlastic.get(key)!.push(e);
    }
    const order = [...plasticGroups].sort((a, b) => b.storeCount - a.storeCount || a.minPrice - b.minPrice);
    const sections = order
      .filter((g) => byPlastic.has(g.key))
      .map((g) => ({ key: g.key, label: g.label, entries: byPlastic.get(g.key)! }));
    // Listings whose plastic the scrapers could not read still belong on the
    // page; they go last, labelled honestly rather than folded into a real one.
    if (byPlastic.has("")) {
      sections.push({ key: "__ukjent", label: "Ukjent plast", entries: byPlastic.get("")! });
    }
    return sections.map((sec) => ({
      ...sec,
      rows: dedupeByStore(sec.entries).map(toStoreRow),
    }));
  }, [filtered, selectedPlastic, showPlasticChips, plasticGroups, plasticLabelByKey]);

  /**
   * The cheapest plastic, when it is not the one selected. Coverage decides the
   * default, and on a disc like the Stingray that means opening on Halo Star at
   * 301 kr because five stores carry it, while DX sits at 125 kr across four.
   * Defensible as a comparison, jarring as a headline — and it contradicts the
   * browse card, which still says "fra kr 125".
   *
   * So the cheap option is surfaced rather than buried: one line, one click to
   * switch. Same principle as the store counts on the chips — stop using a
   * number dishonestly without hiding it.
   */
  const cheaperAlternative = useMemo(() => {
    if (selectedPlastic === null) return null;
    const current = plasticGroups.find((g) => g.key === selectedPlastic);
    if (!current || current.minPrice === Infinity) return null;
    const cheapest = plasticGroups
      .filter((g) => g.storeCount > 0 && g.minPrice < current.minPrice)
      .sort((a, b) => a.minPrice - b.minPrice)[0];
    return cheapest ?? null;
  }, [plasticGroups, selectedPlastic]);

  const bestEntry = useMemo(() => {
    const rows = deduplicatedEntries.map((e) => ({
      ...e,
      total: entryLandedNOK(e, e),
    }));
    return rows.filter((r) => r.inStock).sort((a, b) => a.total - b.total)[0] ?? null;
  }, [deduplicatedEntries]);

  const inStockCount = deduplicatedEntries.filter((e) => e.inStock).length;

  // ── Breadcrumb ──────────────────────────────────────────────────────────────

  const breadcrumbHref = `/browse?type=${disc.type}`;

  const breadcrumbLabel = (TYPE_LABELS_CLIENT[disc.type] ?? disc.type) + "s";

  const flightCells = [
    { label: "Speed", value: disc.flight.speed },
    { label: "Glide", value: disc.flight.glide },
    { label: "Turn", value: disc.flight.turn },
    { label: "Fade", value: disc.flight.fade },
  ];

  return (
    <>
      {/* ── Main info section (cream bg) ──────────────────────────────────── */}
      <section className="w-full bg-[#FFFDF6] px-4 pb-10 pt-2 sm:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Two-column grid on desktop — each column is a single flex-col div */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[40%_1fr] md:items-start md:gap-8">

            {/* ══ LEFT COLUMN ═══════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">

              {/* Disc image */}
              <div className="overflow-hidden rounded-2xl border-2 border-[#101C14] bg-white shadow-[5px_5px_0_#B8E04A]">
                <div className="flex items-center justify-center p-6" style={{ minHeight: 260 }}>
                  <DiscImage src={disc.image} name={disc.name} brand={disc.brand} type={disc.type} containerStyle={{ height: 260 }} />
                </div>
              </div>

              {/* Beste pris — mobile only: on md+ the grid stacks left/right
                  columns as whole blocks, so this needs its own copy right
                  under the image instead of relying on the one further down
                  the (desktop-only-adjacent) right column. */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:hidden">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#101C1499]">Beste pris</span>
                {bestEntry != null ? (
                  <>
                    <span className="text-lg font-extrabold text-[#101C14]">kr {bestEntry.total}</span>
                    {/* Counts the selected plastic, and names the total
                        alongside it. "19 butikker" that compared five different
                        products was the broken promise; this keeps coverage
                        visible without making that claim. */}
                    {inStockCount > 0 && (
                      <span className="text-sm text-[#101C1499]">
                        · {inStockCount} butikk{inStockCount !== 1 ? "er" : ""}
                        {selectedPlastic !== null && totalStoreCount > inStockCount
                          ? ` · ${totalStoreCount} totalt`
                          : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-[#101C1499]">· ikke tilgjengelig</span>
                )}
              </div>

              {/* Flight path card */}
              <div className="rounded-2xl border-2 border-[#101C14] bg-white p-4 shadow-[4px_4px_0_#B8E04A]">
                <div className="mb-1 text-sm font-extrabold text-[#101C14]">Flyvebane</div>
                <p className="mb-2 text-[11px] text-[#101C1499]">RHBH-flybaner sett ovenfra etter armhastighet.</p>
                <FlightPathSVG flight={disc.flight} />
              </div>

            </div>

            {/* ══ RIGHT COLUMN ══════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">

              {/* Brand · type badge (+ HOT/TOUR tags) */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/brand/${BRAND_SLUG[disc.brand] ?? disc.brand.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm font-semibold text-[#101C1499] transition-colors hover:text-[#101C14]"
                >
                  {disc.brand}
                </Link>
                <span className="text-[#101C1499]">·</span>
                <span className="rounded-md bg-[#F1EFE6] px-2.5 py-1 text-xs font-semibold text-[#101C14]">
                  {TYPE_LABELS_CLIENT[disc.type] ?? disc.type}
                </span>
                {disc.tags.map((tag) => {
                  const style = BADGE_STYLES_CLIENT[tag];
                  return (
                    <span
                      key={tag}
                      className="dd-sticker text-[10px]"
                      style={style ? { background: style.bg, color: style.text, boxShadow: "2px 2px 0 #101C14" } : undefined}
                    >
                      {style?.label ?? tag.toUpperCase()}
                    </span>
                  );
                })}
                {disc.player && <span className="text-sm text-[#101C1499]">{disc.player}</span>}
              </div>

              {/* Disc name */}
              <div className="flex items-center gap-2.5">
                <BrandLogo brand={disc.brand} />
                <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-tight tracking-tight text-[#101C14]">
                  {disc.name}
                </h1>
              </div>

              {/* Beste pris — desktop only (mobile has its own copy right under the image) */}
              <div className="hidden flex-wrap items-baseline gap-x-2 gap-y-0.5 md:flex">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#101C1499]">Beste pris</span>
                {bestEntry != null ? (
                  <>
                    <span className="text-lg font-extrabold text-[#101C14]">kr {bestEntry.total}</span>
                    {/* Counts the selected plastic, and names the total
                        alongside it. "19 butikker" that compared five different
                        products was the broken promise; this keeps coverage
                        visible without making that claim. */}
                    {inStockCount > 0 && (
                      <span className="text-sm text-[#101C1499]">
                        · {inStockCount} butikk{inStockCount !== 1 ? "er" : ""}
                        {selectedPlastic !== null && totalStoreCount > inStockCount
                          ? ` · ${totalStoreCount} totalt`
                          : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-[#101C1499]">· ikke tilgjengelig</span>
                )}
                {lastUpdated && (
                  <span className="text-xs text-[#101C1499]">
                    <RelativeTime iso={lastUpdated} prefix="· Oppdatert " />
                  </span>
                )}
              </div>

              {/* Description */}
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-[#101C1499]">{description}</p>
              )}

              {/* Plastic chips */}
              {showPlasticChips && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#101C1499]">Plastikk</div>
                  <div className="flex flex-wrap gap-2">
                    {/* The counts are the point: "Alle (19)" keeps the full
                        coverage visible while each plastic shows how many
                        stores actually stock that one, so the headline number
                        is never a promise the table cannot keep. */}
                    <Chip
                      label={`Alle (${totalStoreCount})`}
                      active={selectedPlastic === null}
                      onClick={() => { setSelectedPlastic(null); setSelectedEdition(null); }}
                    />
                    {plasticGroups.map((g) => (
                      <Chip
                        key={g.key}
                        label={g.storeCount > 0 ? `${g.label} (${g.storeCount})` : g.label}
                        active={selectedPlastic === g.key}
                        onClick={() => { setSelectedPlastic(g.key); setSelectedEdition(null); }}
                      />
                    ))}
                  </div>
                  {cheaperAlternative && (
                    <button
                      type="button"
                      onClick={() => { setSelectedPlastic(cheaperAlternative.key); setSelectedEdition(null); }}
                      className="mt-2 text-left text-[11px] text-[#101C1499] underline decoration-dotted underline-offset-2 hover:text-[#2D6A4F]"
                    >
                      Billigst uansett plast: kr {cheaperAlternative.minPrice} med {cheaperAlternative.label}
                    </button>
                  )}
                </div>
              )}

              {/* Edition chips */}
              {showEditionChips && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#101C1499]">Utgave</div>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="Alle" active={selectedEdition === null} onClick={() => setSelectedEdition(null)} />
                    {editions.map((e) => (
                      <Chip key={e} label={e} active={selectedEdition === e} onClick={() => setSelectedEdition(e)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Flight numbers */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#101C1499]">Flyvetall</div>
                <div className="grid grid-cols-4 gap-2">
                  {flightCells.map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[#F1EFE6] px-2 py-3 text-center"
                    >
                      <div className="mt-0.5 text-3xl font-extrabold text-[#101C14]">{value}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#101C1488]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prissammenligning — inline in right column. Under "Alle",
                  one table per plastic rather than a single mixed ranking. */}
              {groupedRows ? (
                <div className="flex flex-col gap-5">
                  {groupedRows.map((sec) => (
                    <div key={sec.key}>
                      <div className="mb-1.5 flex items-baseline gap-2">
                        <span className="text-sm font-extrabold text-[#101C14]">{sec.label}</span>
                        <span className="text-[11px] text-[#101C1499]">
                          {sec.rows.filter((r) => r.inStock).length} butikker på lager
                        </span>
                      </div>
                      {/* Grouped view: each section is already one plastic and
                          is titled with it, so the per-row chip is redundant. */}
                      <PriceTable stores={sec.rows} lastUpdated={lastUpdated} hideHeader inline />
                    </div>
                  ))}
                </div>
              ) : (
                <PriceTable
                  stores={storeRows}
                  lastUpdated={lastUpdated}
                  hideHeader
                  inline
                />
              )}

              {/* Bli varslet — inline in right column */}
              <PriceAlertSignup discId={discId} discName={disc.name} inline />

            </div>

          </div>
        </div>
      </section>

      {/* Sticky mobile buy bar */}
      {bestEntry && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[#101C14] bg-[#FFFDF6]/97 px-4 py-3 backdrop-blur-sm md:hidden">
          <a
            href={bestEntry.url}
            target="_blank"
            rel="noopener"
            className="dd-cta flex w-full items-center gap-3 px-5 py-3.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold opacity-90">
              Beste pris: <span className="font-extrabold">kr {bestEntry.total}</span> hos {bestEntry.storeName}
              {bestEntry.plastic ? ` (${plasticLabelByKey.get(plasticKey(bestEntry.plastic)) ?? bestEntry.plastic})` : ""}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold">
              Kjøp
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </a>
        </div>
      )}
    </>
  );
}

// ── Price Alert Signup ───────────────────────────────────────────────────────

export function PriceAlertSignup({ discId, discName, inline }: { discId: string; discName: string; inline?: boolean }) {
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !consent || validatePriceThreshold(targetPrice)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discId,
          email,
          targetPrice: targetPrice ? Number(targetPrice) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Noe gikk galt. Prøv igjen.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div className="rounded-2xl border-2 border-[#101C14] bg-[#101C14] px-6 py-5 shadow-[4px_4px_0_#B8E04A]">
          {submitted ? (
            <div className="flex items-center gap-4">
              <span className="text-3xl text-[#B8E04A]">✓</span>
              <div>
                <p className="font-extrabold text-[#FFFDF6]">Varsel opprettet!</p>
                <p className="text-sm text-[#FFFDF6]/70">
                  {targetPrice
                    ? `Vi sender deg en e-post når ${discName} går under ønsket pris.`
                    : `Vi sender deg en e-post så snart ${discName} er tilgjengelig i en butikk.`}
                </p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-xl font-extrabold text-[#FFFDF6]">Bli varslet</h2>
              <p className="mb-4 text-xs text-[#FFFDF6]/60">
                La prisfeltet stå tomt for å bli varslet så snart disken er tilgjengelig, uansett pris.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-start gap-3 md:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="alert-email" className="mb-1 block text-xs font-semibold text-[#FFFDF6]/70">
                      E-post
                    </label>
                    <input
                      id="alert-email"
                      type="email"
                      required
                      placeholder="din@epost.no"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#FFFDF6] placeholder:text-[#FFFDF6]/50 outline-none focus:border-[#B8E04A]/60"
                    />
                  </div>
                  <PriceThresholdInput value={targetPrice} onChange={setTargetPrice} variant="dark" className="w-48 shrink-0" />
                  <button
                    type="submit"
                    disabled={!consent || loading || validatePriceThreshold(targetPrice) != null}
                    className="dd-cta mt-[21px] whitespace-nowrap px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "Lagrer…" : "Varsle meg"}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#B8E04A]"
                  />
                  <span className="text-xs leading-relaxed text-[#FFFDF6]/70">
                    Jeg godtar at discdrop lagrer e-postadressen min for å sende prisvarsler. Se vår{" "}
                    <a href="/personvern" className="underline underline-offset-2 transition-colors hover:text-[#B8E04A]">
                      personvernserklæring
                    </a>
                    .
                  </span>
                </label>
              </form>
            </>
          )}
        </div>
  );

  if (inline) return card;

  return (
    <section className="w-full bg-[#FFFDF6] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {card}
      </div>
    </section>
  );
}
