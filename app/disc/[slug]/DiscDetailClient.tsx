"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import type { RichStoreEntry } from "@/lib/disc-utils";

// ── Types ───────────────────────────────────────────────────────────────────

type Store = {
  name: string;
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

/** Future-ready: international store entry with currency + VOEC info */
type IntlStore = {
  name: string;
  flag: string;
  priceLocal: number;
  currency: string;
  rateToNOK: number;
  shippingLocal: number;
  freeShippingLocalOver?: number;
  voec: boolean; // true = MVA pre-paid via VOEC, false = collected at delivery
  url: string;
  inStock: boolean;
};

// ── Price Comparison Table ───────────────────────────────────────────────────

function formatLastUpdated(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "akkurat nå";
  if (hours === 1) return "for 1 time siden";
  if (hours < 24) return `for ${hours} timer siden`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "for 1 dag siden" : `for ${days} dager siden`;
}

export function PriceTable({
  stores,
  intlStores = [],
  lastUpdated,
  hideHeader,
  inline,
}: {
  stores: Store[];
  intlStores?: IntlStore[];
  lastUpdated?: string | null;
  hideHeader?: boolean;
  inline?: boolean;
}) {
  if (stores.length === 0 && intlStores.length === 0) {
    if (hideHeader || inline) return null;
    return (
      <section className="w-full bg-[#F5F2EB] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
            Hvor kan du kjøpe
          </h2>
          <p className="mt-6 rounded-2xl border border-[#e0ddd4] bg-white px-6 py-8 text-center text-sm text-[#aaa]">
            Ingen priser funnet ennå. Vi oppdaterer prisene daglig.
          </p>
        </div>
      </section>
    );
  }

  const rows: StoreRow[] = stores
    .map((s) => {
      const shippingNOK = s.price >= s.freeShippingOver ? 0 : s.shipping;
      return { ...s, shippingNOK, total: s.price + shippingNOK };
    })
    .sort((a, b) => {
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return a.total - b.total;
    });

  const bestTotal = rows.find((r) => r.inStock)?.total ?? rows[0]?.total;

  // International rows with MVA calculation
  type IntlRow = IntlStore & {
    diskNOK: number;
    shippingNOK: number;
    subtotalNOK: number;
    mvaNOK: number;
    totalNOK: number;
  };
  const intlRows: IntlRow[] = intlStores
    .map((s) => {
      const freeOver = s.freeShippingLocalOver ?? Infinity;
      const shippingLocal = s.priceLocal >= freeOver ? 0 : s.shippingLocal;
      const diskNOK = Math.round(s.priceLocal * s.rateToNOK);
      const shippingNOK = Math.round(shippingLocal * s.rateToNOK);
      const subtotalNOK = diskNOK + shippingNOK;
      const mvaNOK = s.voec ? 0 : Math.round(subtotalNOK * 0.25);
      return { ...s, diskNOK, shippingNOK, subtotalNOK, mvaNOK, totalNOK: subtotalNOK + mvaNOK };
    })
    .sort((a, b) => {
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return a.totalNOK - b.totalNOK;
    });

  return (
    <div className={inline ? undefined : "w-full bg-[#F5F2EB] px-4 pb-10 pt-4 sm:px-8"}>
      <div className={inline ? undefined : "mx-auto max-w-4xl"}>
        {!hideHeader && (
          <>
            <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
              Hvor kan du kjøpe
            </h2>
            <p className="mb-3 text-sm text-[#666]">
              Sortert etter totalpris inkl. frakt.
            </p>
          </>
        )}

        {/* ── Norwegian stores ── */}
        {rows.length > 0 && (
          <>
            {intlRows.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-base">🇳🇴</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                  Norske butikker
                </span>
              </div>
            )}

            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-[#e0ddd4] bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8e8e4] bg-[#f7f6f2] text-left text-xs uppercase tracking-wider text-[#888]">
                    <th className={inline ? "px-3 py-2" : "px-5 py-3"}>Butikk</th>
                    {!inline && <th className="px-4 py-3">Lager</th>}
                    <th className={inline ? "px-3 py-2" : "px-4 py-3"}>Diskpris</th>
                    <th className={inline ? "px-3 py-2" : "px-4 py-3"}>Frakt</th>
                    <th className={`font-bold text-[#2D6A4F] ${inline ? "px-3 py-2" : "px-4 py-3"}`}>Total</th>
                    <th className={inline ? "px-2 py-2" : "px-4 py-3"}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isBest = row.total === bestTotal && row.inStock;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-[#f0ede6] last:border-0 transition-colors ${
                          isBest ? "bg-[#f0f9e8]" : "hover:bg-[#fafaf8]"
                        } ${!row.inStock && inline ? "opacity-60" : ""}`}
                      >
                        <td className={inline ? "px-3 py-2" : "px-5 py-4"}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.country === "SE" && <span title="Svensk butikk">🇸🇪</span>}
                            <span className="font-medium text-[#1a1a1a]">{row.name}</span>
                            {isBest && (
                              <span className="rounded-full bg-[#B8E04A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E3D2F]">
                                Beste deal
                              </span>
                            )}
                            {inline && !row.inStock && (
                              <span className="text-[11px] text-[#E8704A]">Utsolgt</span>
                            )}
                          </div>
                          {row.country === "SE" && row.voec && !inline && (
                            <div className="mt-0.5 text-[11px] text-[#888]">inkl. frakt og MVA</div>
                          )}
                        </td>
                        {!inline && (
                          <td className="px-4 py-4">
                            <StockDot inStock={row.inStock} />
                          </td>
                        )}
                        <td className={`${inline ? "px-3 py-2" : "px-4 py-4"} text-[#444]`}>kr {row.price}</td>
                        <td className={`${inline ? "px-3 py-2" : "px-4 py-4"} text-[#444]`}>
                          {row.shippingNOK > 0 ? (
                            `kr ${row.shippingNOK}`
                          ) : (
                            <span className="font-medium text-[#2D6A4F]">Gratis</span>
                          )}
                        </td>
                        <td className={inline ? "px-3 py-2" : "px-4 py-4"}>
                          <span className="font-semibold text-[#1a1a1a]">kr {row.total}</span>
                        </td>
                        <td className={inline ? "px-2 py-2" : "px-4 py-4"}>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-block rounded-lg bg-[#2D6A4F] text-xs font-medium text-white transition-all duration-150 hover:brightness-110 ${inline ? "px-2 py-1.5" : "px-4 py-2"}`}
                            aria-disabled={!row.inStock}
                            tabIndex={row.inStock ? 0 : -1}
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
                    className={`rounded-2xl border p-4 ${
                      isBest ? "border-[#B8E04A] bg-[#f0f9e8]" : "border-[#e0ddd4] bg-white"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.country === "SE" && <span title="Svensk butikk">🇸🇪</span>}
                          <span className="font-semibold text-[#1a1a1a]">{row.name}</span>
                          {isBest && (
                            <span className="rounded-full bg-[#B8E04A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E3D2F]">
                              Beste deal
                            </span>
                          )}
                        </div>
                        {row.country === "SE" && row.voec && (
                          <div className="mt-0.5 text-[11px] text-[#888]">inkl. frakt og MVA</div>
                        )}
                      </div>
                      <StockDot inStock={row.inStock} />
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-xs text-[#666]">
                      <div>
                        <div className="uppercase tracking-wider">Diskpris</div>
                        <div className="font-medium text-[#1a1a1a]">kr {row.price}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wider">Frakt</div>
                        <div className="font-medium text-[#1a1a1a]">
                          {row.shippingNOK > 0 ? `kr ${row.shippingNOK}` : "Gratis"}
                        </div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wider">Total</div>
                        <div className="font-semibold text-[#1a1a1a]">kr {row.total}</div>
                      </div>
                    </div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-lg bg-[#2D6A4F] py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                    >
                      Gå til butikk
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── International stores ── */}
        {intlRows.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-base">🌍</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                Internasjonale butikker
              </span>
            </div>

            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-[#e0ddd4] bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8e8e4] bg-[#f7f6f2] text-left text-xs uppercase tracking-wider text-[#888]">
                    <th className="px-5 py-3">Butikk</th>
                    <th className="px-4 py-3">Lager</th>
                    <th className="px-4 py-3">Diskpris</th>
                    <th className="px-4 py-3">Frakt</th>
                    <th className="px-4 py-3">MVA (25%)</th>
                    <th className="px-4 py-3 font-bold text-[#2D6A4F]">Total NOK</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {intlRows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#f0ede6] last:border-0 transition-colors hover:bg-[#fafaf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span>{row.flag}</span>
                          <span className="font-medium text-[#1a1a1a]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StockDot inStock={row.inStock} />
                      </td>
                      <td className="px-4 py-4 text-[#444]">
                        <div>kr {row.diskNOK}</div>
                        <div className="text-[11px] text-[#aaa]">
                          {row.priceLocal} {row.currency}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#444]">
                        {row.shippingNOK > 0 ? (
                          <div>
                            <div>kr {row.shippingNOK}</div>
                            <div className="text-[11px] text-[#aaa]">
                              {row.shippingLocal} {row.currency}
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium text-[#2D6A4F]">Gratis</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {row.voec ? (
                          <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-medium text-[#2D6A4F]">
                            MVA inkl.
                          </span>
                        ) : (
                          <div>
                            <div className="text-[#444]">+ kr {row.mvaNOK}</div>
                            <span className="mt-0.5 inline-block rounded-full bg-[#fff8e1] px-2 py-0.5 text-[10px] font-medium text-[#b45309]">
                              MVA ved levering
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-[#1a1a1a]">kr {row.totalNOK}</span>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-lg bg-[#2D6A4F] px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110"
                        >
                          Gå til butikk
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {intlRows.map((row, i) => (
                <div key={i} className="rounded-2xl border border-[#e0ddd4] bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{row.flag}</span>
                      <span className="font-semibold text-[#1a1a1a]">{row.name}</span>
                    </div>
                    <StockDot inStock={row.inStock} />
                  </div>
                  <div className="mb-3 grid grid-cols-4 gap-2 text-xs text-[#666]">
                    <div>
                      <div className="uppercase tracking-wider">Diskpris</div>
                      <div className="font-medium text-[#1a1a1a]">kr {row.diskNOK}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">Frakt</div>
                      <div className="font-medium text-[#1a1a1a]">
                        {row.shippingNOK > 0 ? `kr ${row.shippingNOK}` : "Gratis"}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">MVA</div>
                      <div className="font-medium text-[#1a1a1a]">
                        {row.voec ? (
                          <span className="text-[#2D6A4F]">Inkl.</span>
                        ) : (
                          `kr ${row.mvaNOK}`
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">Total</div>
                      <div className="font-semibold text-[#1a1a1a]">kr {row.totalNOK}</div>
                    </div>
                  </div>
                  {!row.voec && (
                    <p className="mb-2 text-[10px] text-[#b45309]">
                      MVA beregnes på disk + frakt kombinert, og betales ved levering.
                    </p>
                  )}
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-lg bg-[#2D6A4F] py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                  >
                    Gå til butikk
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#aaa]">
              MVA beregnes på disk + frakt kombinert. VOEC-registrerte butikker krever inn MVA ved kjøp.
            </p>
          </div>
        )}

        <p className="mt-4 text-xs text-[#888]">
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
      <span className="text-xs text-[#666]">{inStock ? "På lager" : "Utsolgt"}</span>
    </div>
  );
}

// ── Price History Chart ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PriceHistoryChart({ priceHistory: _, inline }: { priceHistory: (number | null)[]; inline?: boolean }) {
  const content = (
    <>
      <h2 className={`mb-1 font-serif font-semibold tracking-tight text-[#1a1a1a] ${inline ? "text-xl" : "text-2xl"}`}>
        Prishistorikk
      </h2>
      <p className="mt-3 rounded-2xl border border-[#e0ddd4] bg-white px-6 py-6 text-center text-sm text-[#aaa]">
        Prishistorikk kommer snart — vi samler inn data daglig.
      </p>
    </>
  );
  if (inline) return <div>{content}</div>;
  return (
    <section className="w-full bg-[#F5F2EB] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">{content}</div>
    </section>
  );
}

// ── Flight Path Chart ────────────────────────────────────────────────────────

type FlightNumbers = { speed: number; glide: number; turn: number; fade: number };

export function FlightPathChart({ flight }: { flight: FlightNumbers }) {
  // SVG layout
  const W = 340, H = 440;
  const padL = 52, padR = 12, padT = 28, padB = 20;
  const chartW = W - padL - padR;   // 276
  const chartH = 300;               // 150 m max distance at 2.0 px/m
  const cx = padL + chartW / 2;    // 190 — center (straight line)
  const baseY = padT + chartH;      // 328 — release point (bottom of chart)
  const scale = 2.0;                // px per metre

  // Base distance in metres: heavier weight on glide for accuracy across disc types
  const baseM = 25 + flight.speed * 6 + flight.glide * 8;

  const arms = [
    { id: "slow",   label: "Sakte arm",  sub: "< 60 km/h",  color: "#4CAF82", distF: 0.78, turnF: 0.15, fadeF: 0.75 },
    { id: "medium", label: "Medium arm", sub: "60–80 km/h", color: "#E8A838", distF: 0.92, turnF: 0.60, fadeF: 0.90 },
    { id: "fast",   label: "Rask arm",   sub: "80+ km/h",   color: "#E8704A", distF: 1.00, turnF: 1.00, fadeF: 1.00 },
  ] as const;

  function calcCurve(arm: (typeof arms)[number]) {
    const distM = Math.min(baseM * arm.distF, 150);
    // Negative turn → drifts right (+x). Positive fade → hooks left (−x).
    const turnM  = -flight.turn * 7 * arm.turnF;
    const fadeM  = -flight.fade * 5 * arm.fadeF;
    const endLat = turnM + fadeM;
    const peakTurn = turnM * 1.5;

    const p0x = cx,                          p0y = baseY;
    const p1x = cx,                          p1y = baseY - distM * scale * 0.35;
    const p2x = cx + peakTurn * scale,       p2y = baseY - distM * scale * 0.65;
    const p3x = cx + endLat   * scale,       p3y = baseY - distM * scale;

    return { d: `M ${p0x} ${p0y} C ${p1x} ${p1y} ${p2x} ${p2y} ${p3x} ${p3y}`, endX: p3x, endY: p3y };
  }

  const yTicks = [50, 100, 150];
  const xTicks = [-60, -40, -20, 0, 20, 40, 60];

  // Legend: 3 items spaced evenly
  const legendY = baseY + padB + 22;
  const legendItemW = chartW / 3;

  return (
    <section className="w-full bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Flybane etter armhastighet
        </h2>
        <p className="mb-6 text-sm text-[#666]">
          Simulerte RHBH-flybaner sett ovenfra. Turn aktiveres mer ved høyere armhastighet.
        </p>
        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ maxWidth: 380, width: "100%" }}
            aria-label="Disc flight path chart"
          >
            {/* Background */}
            <rect width={W} height={H} fill="#F5F2EB" rx="12" />
            {/* Chart area */}
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="white" rx="6" />

            {/* Y-axis grid lines + labels (distance markers) */}
            {yTicks.map((m) => {
              const y = baseY - m * scale;
              return (
                <g key={`y-${m}`}>
                  <line x1={padL} y1={y} x2={padL + chartW} y2={y}
                    stroke="#2D6A4F" strokeWidth="0.5" strokeOpacity="0.25" />
                  <text x={padL - 5} y={y + 4} textAnchor="end"
                    fontSize="9" fill="#2D6A4F" fontFamily="system-ui,sans-serif">
                    {m}m
                  </text>
                </g>
              );
            })}
            <text x={padL - 5} y={baseY + 4} textAnchor="end"
              fontSize="9" fill="#2D6A4F" fontFamily="system-ui,sans-serif">
              0m
            </text>

            {/* X-axis grid lines + labels (lateral drift) */}
            {xTicks.map((m) => {
              const x = cx + m * scale;
              const isCenter = m === 0;
              return (
                <g key={`x-${m}`}>
                  <line x1={x} y1={padT} x2={x} y2={baseY}
                    stroke="#2D6A4F"
                    strokeWidth={isCenter ? 1.0 : 0.5}
                    strokeOpacity={isCenter ? 0.45 : 0.18}
                    strokeDasharray={isCenter ? undefined : "3 3"} />
                </g>
              );
            })}

            {/* Directional hints */}
            <text x={padL + 5} y={padT + 15} fontSize="8" fill="#2D6A4F"
              fontFamily="system-ui,sans-serif" opacity="0.55">
              ← Fade (venstre)
            </text>
            <text x={padL + chartW - 5} y={padT + 15} fontSize="8" fill="#2D6A4F"
              fontFamily="system-ui,sans-serif" opacity="0.55" textAnchor="end">
              Turn (høyre) →
            </text>

            {/* Flight path curves — slow first so fast renders on top */}
            {arms.map((arm) => {
              const { d, endX, endY } = calcCurve(arm);
              return (
                <g key={arm.id}>
                  <path d={d} fill="none" stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx={endX} cy={endY} r="3.5" fill={arm.color} />
                </g>
              );
            })}

            {/* Release dot */}
            <circle cx={cx} cy={baseY} r="5" fill="#2D6A4F" opacity="0.18" />
            <circle cx={cx} cy={baseY} r="3" fill="#2D6A4F" />
            <circle cx={cx} cy={baseY} r="1.5" fill="#F5F2EB" />

            {/* Legend */}
            {arms.map((arm, i) => {
              const lx = padL + i * legendItemW + 6;
              const ly = legendY;
              return (
                <g key={`legend-${arm.id}`}>
                  <line x1={lx} y1={ly + 5} x2={lx + 18} y2={ly + 5}
                    stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx={lx + 18} cy={ly + 5} r="3" fill={arm.color} />
                  <text x={lx + 25} y={ly + 9} fontSize="9" fill="#1a1a1a"
                    fontFamily="system-ui,sans-serif" fontWeight="600">
                    {arm.label}
                  </text>
                  <text x={lx + 25} y={ly + 21} fontSize="8" fill="#666"
                    fontFamily="system-ui,sans-serif">
                    {arm.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}

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
      <div className="flex rounded-full bg-[#e8e4dc] p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setIsForehand(false)}
          className={`rounded-full px-3 py-1 transition-colors ${!isForehand ? "bg-[#2D6A4F] text-white" : "text-[#666] hover:text-[#1a1a1a]"}`}
        >
          BH
        </button>
        <button
          type="button"
          onClick={() => setIsForehand(true)}
          className={`rounded-full px-3 py-1 transition-colors ${isForehand ? "bg-[#2D6A4F] text-white" : "text-[#666] hover:text-[#1a1a1a]"}`}
        >
          FH
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 340, width: "100%" }} aria-label="Disc flight path chart">
        <rect width={W} height={H} fill="#F8F7F3" rx="12" />
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="white" rx="6" />
        {yTicks.map((m) => {
          const y = baseY - m * scale;
          return (
            <g key={`y-${m}`}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#2D6A4F" strokeWidth="0.5" strokeOpacity="0.25" />
              <text x={padL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#2D6A4F" fontFamily="system-ui,sans-serif">{m}m</text>
            </g>
          );
        })}
        <text x={padL - 5} y={baseY + 4} textAnchor="end" fontSize="9" fill="#2D6A4F" fontFamily="system-ui,sans-serif">0m</text>
        {xTicks.map((m) => {
          const x = cx + m * scale;
          const isCenter = m === 0;
          return (
            <g key={`x-${m}`}>
              <line x1={x} y1={padT} x2={x} y2={baseY} stroke="#2D6A4F"
                strokeWidth={isCenter ? 1.0 : 0.5} strokeOpacity={isCenter ? 0.45 : 0.18}
                strokeDasharray={isCenter ? undefined : "3 3"} />
            </g>
          );
        })}
        <text x={padL + 5} y={padT + 15} fontSize="8" fill="#2D6A4F" fontFamily="system-ui,sans-serif" opacity="0.55">{leftLabel}</text>
        <text x={padL + chartW - 5} y={padT + 15} fontSize="8" fill="#2D6A4F" fontFamily="system-ui,sans-serif" opacity="0.55" textAnchor="end">{rightLabel}</text>
        {arms.map((arm) => {
          const { d, endX, endY } = calcCurve(arm);
          return (
            <g key={arm.id}>
              <path d={d} fill="none" stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={endX} cy={endY} r="3.5" fill={arm.color} />
            </g>
          );
        })}
        <circle cx={cx} cy={baseY} r="5" fill="#2D6A4F" opacity="0.18" />
        <circle cx={cx} cy={baseY} r="3" fill="#2D6A4F" />
        <circle cx={cx} cy={baseY} r="1.5" fill="#F5F2EB" />
        {arms.map((arm, i) => {
          const lx = padL + i * legendItemW + 6;
          const ly = legendY;
          return (
            <g key={`legend-${arm.id}`}>
              <line x1={lx} y1={ly + 5} x2={lx + 18} y2={ly + 5} stroke={arm.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={lx + 18} cy={ly + 5} r="3" fill={arm.color} />
              <text x={lx + 25} y={ly + 9} fontSize="9" fill="#1a1a1a" fontFamily="system-ui,sans-serif" fontWeight="600">{arm.label}</text>
              <text x={lx + 25} y={ly + 21} fontSize="8" fill="#666" fontFamily="system-ui,sans-serif">{arm.sub}</text>
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
      className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-all min-h-[44px] ${
        active
          ? "border-[#2D6A4F] bg-[#2D6A4F] text-white shadow-sm"
          : "border-[#ddd] bg-white text-[#444] hover:border-[#2D6A4F]/50 hover:text-[#2D6A4F]"
      }`}
    >
      {label}
    </button>
  );
}

export function VariantPriceSection({
  allEntries,
  lastUpdated,
}: {
  allEntries: RichStoreEntry[];
  lastUpdated?: string | null;
}) {
  // Unique non-null plastic types across all entries for this disc
  const plastics = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of allEntries) {
      if (e.plastic && !seen.has(e.plastic)) {
        seen.add(e.plastic);
        out.push(e.plastic);
      }
    }
    return out;
  }, [allEntries]);

  // Show plastic chips only when 2+ distinct plastics exist
  const showPlasticChips = plastics.length >= 2;

  // Default to the plastic with the cheapest in-stock entry
  const defaultPlastic = useMemo(() => {
    if (!showPlasticChips) return null;
    let best: string | null = null;
    let bestPrice = Infinity;
    for (const p of plastics) {
      const pEntries = allEntries.filter((e) => e.plastic === p && e.inStock);
      const min = pEntries.length ? Math.min(...pEntries.map((e) => e.price)) : Infinity;
      if (min < bestPrice) { bestPrice = min; best = p; }
    }
    return best ?? plastics[0] ?? null;
  }, [allEntries, plastics, showPlasticChips]);

  // Default to null = "Alle" so count reflects all stores on first render
  const [selectedPlastic, setSelectedPlastic] = useState<string | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);

  // Entries for selected plastic (all entries if "Alle" or chips aren't shown)
  const plasticEntries = useMemo(() => {
    if (!showPlasticChips || selectedPlastic === null) return allEntries;
    return allEntries.filter((e) => e.plastic === selectedPlastic);
  }, [allEntries, selectedPlastic, showPlasticChips]);

  // Unique non-null editions within the selected plastic
  const editions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of plasticEntries) {
      if (e.edition && !seen.has(e.edition)) {
        seen.add(e.edition);
        out.push(e.edition);
      }
    }
    return out;
  }, [plasticEntries]);

  const showEditionChips = editions.length >= 1;

  // Final filtered entries for the price table
  const filtered = useMemo(
    () => selectedEdition ? plasticEntries.filter((e) => e.edition === selectedEdition) : plasticEntries,
    [plasticEntries, selectedEdition]
  );

  // Deduplicate by store: one row per store, cheapest in-stock entry wins
  const deduplicatedEntries = useMemo(() => {
    const byStore = new Map<string, RichStoreEntry>();
    for (const e of filtered) {
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
  }, [filtered]);

  const storeRows: Store[] = deduplicatedEntries.map((e) => ({
    name: e.storeName,
    price: e.price,
    inStock: e.inStock,
    url: e.url,
    shipping: e.shipping,
    freeShippingOver: e.freeShippingOver,
    country: e.country,
    voec: e.voec,
  }));

  // Best in-stock entry for sticky mobile CTA
  const bestEntry = useMemo(() => {
    const rows = deduplicatedEntries.map((e) => ({
      ...e,
      total: e.price + (e.price >= e.freeShippingOver ? 0 : e.shipping),
    }));
    return rows.filter((r) => r.inStock).sort((a, b) => a.total - b.total)[0] ?? null;
  }, [deduplicatedEntries]);

  if (allEntries.length === 0) {
    return <PriceTable stores={[]} lastUpdated={lastUpdated} />;
  }

  return (
    <>
      <section className="w-full bg-[#F5F2EB] px-4 pt-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
            Hvor kan du kjøpe
          </h2>
          <p className="mb-4 text-sm text-[#666]">
            Alle priser i NOK, inkl. MVA. Sortert etter totalpris inkl. frakt.
          </p>

          {/* Plastic chips — only when 2+ distinct plastics */}
          {showPlasticChips && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888]">
                Plastikk
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <Chip
                  label="Alle"
                  active={selectedPlastic === null}
                  onClick={() => { setSelectedPlastic(null); setSelectedEdition(null); }}
                />
                {plastics.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={selectedPlastic === p}
                    onClick={() => { setSelectedPlastic(p); setSelectedEdition(null); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Edition chips — only when editions exist within selected plastic */}
          {showEditionChips && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888]">
                Utgave
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <Chip
                  label="Alle"
                  active={selectedEdition === null}
                  onClick={() => setSelectedEdition(null)}
                />
                {editions.map((e) => (
                  <Chip
                    key={e}
                    label={e}
                    active={selectedEdition === e}
                    onClick={() => setSelectedEdition(e)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Price table — without its own section header */}
      <PriceTable stores={storeRows} lastUpdated={lastUpdated} hideHeader />

      {/* Sticky mobile buy bar — hidden on desktop */}
      {bestEntry && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e0ddd4] bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden">
          <a
            href={bestEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-between rounded-xl bg-[#2D6A4F] px-5 py-3.5 text-white transition-all hover:brightness-110 active:scale-95"
          >
            <span className="text-sm font-medium opacity-90">
              Beste pris: <span className="font-bold">kr {bestEntry.total}</span> hos {bestEntry.storeName}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-[#B8E04A]">
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

// ── Disc Hero Section ────────────────────────────────────────────────────────

const TYPE_LABELS_CLIENT: Record<string, string> = {
  driver: "Distance Driver",
  midrange: "Midrange",
  putter: "Putter",
};

const BADGE_STYLES_CLIENT: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#E8704A", text: "#fff", label: "HOT" },
  new: { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "BEGRENSET" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
  "sold-out": { bg: "#888", text: "#fff", label: "UTSOLGT" },
  upcoming: { bg: "#3B82F6", text: "#fff", label: "KOMMENDE" },
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

  const plastics = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of allEntries) {
      if (e.plastic && !seen.has(e.plastic)) { seen.add(e.plastic); out.push(e.plastic); }
    }
    return out;
  }, [allEntries]);

  const showPlasticChips = plastics.length >= 2;

  const defaultPlastic = useMemo(() => {
    if (!showPlasticChips) return null;
    let best: string | null = null;
    let bestPrice = Infinity;
    for (const p of plastics) {
      const min = allEntries.filter((e) => e.plastic === p && e.inStock)
        .reduce((m, e) => Math.min(m, e.price), Infinity);
      if (min < bestPrice) { bestPrice = min; best = p; }
    }
    return best ?? plastics[0] ?? null;
  }, [allEntries, plastics, showPlasticChips]);

  // Default to null = "Alle" so count reflects all stores on first render
  const [selectedPlastic, setSelectedPlastic] = useState<string | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);

  const plasticEntries = useMemo(
    () => (!showPlasticChips || selectedPlastic === null) ? allEntries : allEntries.filter((e) => e.plastic === selectedPlastic),
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
  const deduplicatedEntries = useMemo(() => {
    const byStore = new Map<string, RichStoreEntry>();
    for (const e of filtered) {
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
  }, [filtered]);

  const storeRows: Store[] = deduplicatedEntries.map((e) => ({
    name: e.storeName,
    price: e.price,
    inStock: e.inStock,
    url: e.url,
    shipping: e.shipping,
    freeShippingOver: e.freeShippingOver,
    country: e.country,
    voec: e.voec,
  }));

  const bestEntry = useMemo(() => {
    const rows = deduplicatedEntries.map((e) => ({
      ...e,
      total: e.price + (e.price >= e.freeShippingOver ? 0 : e.shipping),
    }));
    return rows.filter((r) => r.inStock).sort((a, b) => a.total - b.total)[0] ?? null;
  }, [deduplicatedEntries]);

  const inStockCount = deduplicatedEntries.filter((e) => e.inStock).length;

  // ── Breadcrumb ──────────────────────────────────────────────────────────────

  const breadcrumbHref =
    disc.type === "driver"
      ? disc.flight.speed >= 10 ? "/browse?type=distance" : "/browse?type=fairway"
      : `/browse?type=${disc.type}`;

  const breadcrumbLabel =
    disc.type === "driver"
      ? disc.flight.speed >= 10 ? "Distance Drivers" : "Fairway Drivers"
      : (TYPE_LABELS_CLIENT[disc.type] ?? disc.type) + "s";

  const flightCells = [
    { label: "Speed", value: disc.flight.speed },
    { label: "Glide", value: disc.flight.glide },
    { label: "Turn", value: disc.flight.turn },
    { label: "Fade", value: disc.flight.fade },
  ];

  return (
    <>
      {/* ── Main info section (cream bg) ──────────────────────────────────── */}
      <section className="w-full bg-[#F5F2EB] px-4 pb-10 pt-6 sm:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Breadcrumb — full width */}
          <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-[#888]">
            <Link href="/" className="transition-colors hover:text-[#2D6A4F]">DiscDrop</Link>
            <span className="opacity-40">/</span>
            <Link href={breadcrumbHref} className="transition-colors hover:text-[#2D6A4F]">{breadcrumbLabel}</Link>
            <span className="opacity-40">/</span>
            <span className="text-[#1a1a1a]">{disc.name}</span>
          </div>

          {/* Two-column grid on desktop — each column is a single flex-col div */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[40%_1fr] md:items-start md:gap-8">

            {/* ══ LEFT COLUMN ═══════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">

              {/* Disc image */}
              <div className="overflow-hidden rounded-2xl border border-[#e0ddd4] bg-white">
                <div className="flex items-center justify-center p-6" style={{ minHeight: 260 }}>
                  <DiscImage src={disc.image} name={disc.name} brand={disc.brand} type={disc.type} containerStyle={{ height: 260 }} />
                </div>
              </div>

              {/* Flight path card */}
              <div className="rounded-2xl border border-[#e0ddd4] bg-white p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#888]">Flybane</div>
                <p className="mb-2 text-[11px] text-[#999]">RHBH-flybaner sett ovenfra etter armhastighet.</p>
                <FlightPathSVG flight={disc.flight} />
              </div>

            </div>

            {/* ══ RIGHT COLUMN ══════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">

              {/* Brand · type badge (+ HOT/TOUR tags) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[#888]">{disc.brand}</span>
                <span className="text-[#ccc]">·</span>
                <span className="rounded-md bg-[#e8f5e9] px-2.5 py-1 text-xs font-medium text-[#2D6A4F]">
                  {TYPE_LABELS_CLIENT[disc.type] ?? disc.type}
                </span>
                {disc.tags.map((tag) => {
                  const style = BADGE_STYLES_CLIENT[tag];
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
                      style={style ? { background: style.bg, color: style.text } : { background: "#555", color: "#fff" }}
                    >
                      {style?.label ?? tag.toUpperCase()}
                    </span>
                  );
                })}
                {disc.player && <span className="text-sm text-[#666]">{disc.player}</span>}
              </div>

              {/* Disc name */}
              <h1 className="font-serif text-[clamp(1.75rem,4vw,3rem)] font-bold leading-tight tracking-tight text-[#1a1a1a]">
                {disc.name}
              </h1>

              {/* Description */}
              {description && (
                <p className="mt-3 text-sm leading-relaxed text-[#555]">{description}</p>
              )}

              {/* Plastic chips */}
              {showPlasticChips && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888]">Plastikk</div>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      label="Alle"
                      active={selectedPlastic === null}
                      onClick={() => { setSelectedPlastic(null); setSelectedEdition(null); }}
                    />
                    {plastics.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        active={selectedPlastic === p}
                        onClick={() => { setSelectedPlastic(p); setSelectedEdition(null); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Edition chips */}
              {showEditionChips && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888]">Utgave</div>
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#888]">Flyvetall</div>
                <div className="grid grid-cols-4 gap-2">
                  {flightCells.map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#e0ddd4] bg-white px-2 py-3 text-center"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#888]">{label}</div>
                      <div className="mt-0.5 font-serif text-3xl font-bold text-[#1a1a1a]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Beste pris — compact single line */}
              <div className="mt-[36px] flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#888]">Beste pris</span>
                {bestEntry != null ? (
                  <>
                    <span className="text-lg font-bold text-[#2D6A4F]">kr {bestEntry.price}</span>
                    {inStockCount > 0 && (
                      <span className="text-sm text-[#999]">· {inStockCount} butikk{inStockCount !== 1 ? "er" : ""}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-[#999]">· ikke tilgjengelig</span>
                )}
                {lastUpdated && (
                  <span className="text-xs text-[#bbb]">· Oppdatert {formatLastUpdated(lastUpdated)}</span>
                )}
              </div>

              {/* Prissammenligning — inline in right column */}
              <PriceTable stores={storeRows} lastUpdated={lastUpdated} hideHeader inline />

              {/* Bli varslet — inline in right column */}
              <PriceAlertSignup discId={discId} discName={disc.name} inline />

            </div>

          </div>
        </div>
      </section>

      {/* Sticky mobile buy bar */}
      {bestEntry && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e0ddd4] bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden">
          <a
            href={bestEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-between rounded-xl bg-[#2D6A4F] px-5 py-3.5 text-white transition-all hover:brightness-110 active:scale-95"
          >
            <span className="text-sm font-medium opacity-90">
              Beste pris: <span className="font-bold">kr {bestEntry.total}</span> hos {bestEntry.storeName}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-[#B8E04A]">
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
    if (!email || !consent) return;
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
    <div className="rounded-2xl bg-[#1E3D2F] px-6 py-5">
          {submitted ? (
            <div className="flex items-center gap-4">
              <span className="text-3xl text-[#B8E04A]">✓</span>
              <div>
                <p className="font-semibold text-[#F5F2EB]">Varsel opprettet!</p>
                <p className="text-sm text-[#9DC08B]">Vi sender deg en e-post når {discName} går under ønsket pris.</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mb-4 font-serif text-xl font-semibold text-[#F5F2EB]">Bli varslet</h2>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-end gap-3 md:flex-nowrap">
                  <input
                    type="email"
                    required
                    placeholder="din@epost.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#F5F2EB] placeholder:text-[#9DC08B]/60 outline-none focus:border-[#B8E04A]/60"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Ønsket pris (kr)"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-44 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#F5F2EB] placeholder:text-[#9DC08B]/60 outline-none focus:border-[#B8E04A]/60"
                  />
                  <button
                    type="submit"
                    disabled={!consent || loading}
                    className="whitespace-nowrap rounded-xl bg-[#B8E04A] px-5 py-3 text-sm font-semibold text-[#1E3D2F] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
                  <span className="text-xs leading-relaxed text-[#9DC08B]/80">
                    Jeg godtar at DiscDrop lagrer e-postadressen min for å sende prisvarsler. Se vår{" "}
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
    <section className="w-full bg-[#F5F2EB] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {card}
      </div>
    </section>
  );
}
