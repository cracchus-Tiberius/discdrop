"use client";

import { useState } from "react";
// ── Types ───────────────────────────────────────────────────────────────────

type Store = {
  name: string;
  price: number;
  inStock: boolean;
  url: string;
  shipping: number;
  freeShippingOver: number;
};

type StoreRow = Store & {
  shippingNOK: number;
  total: number;
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

export function PriceTable({ stores, lastUpdated }: { stores: Store[]; lastUpdated?: string | null }) {
  if (stores.length === 0) {
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

  return (
    <section className="w-full bg-[#F5F2EB] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Hvor kan du kjøpe
        </h2>
        <p className="mb-3 text-sm text-[#666]">
          Alle priser i NOK, inkl. MVA. Sortert etter totalpris inkl. frakt.
        </p>
        <p className="mb-3 text-[12px] italic text-[#888]">
          Prislenker er affiliate-lenker — vi tjener provisjon på kjøp. Dette påvirker ikke prisene du ser.
        </p>
        {lastUpdated && (
          <p className="mb-5 text-[11px] text-[#aaa]">
            Priser sist oppdatert: {formatLastUpdated(lastUpdated)}
          </p>
        )}

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-2xl border border-[#e0ddd4] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8e8e4] bg-[#f7f6f2] text-left text-xs uppercase tracking-wider text-[#888]">
                <th className="px-5 py-3">Store</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Shipping</th>
                <th className="px-4 py-3 font-bold text-[#2D6A4F]">Total NOK</th>
                <th className="px-4 py-3"></th>
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
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇳🇴</span>
                        <span className="font-medium text-[#1a1a1a]">
                          {row.name}
                        </span>
                        {isBest && (
                          <span className="rounded-full bg-[#B8E04A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E3D2F]">
                            Beste deal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StockDot inStock={row.inStock} />
                    </td>
                    <td className="px-4 py-4 text-[#444]">
                      kr {row.price}
                    </td>
                    <td className="px-4 py-4 text-[#444]">
                      {row.shippingNOK > 0 ? `kr ${row.shippingNOK}` : (
                        <span className="text-[#2D6A4F] font-medium">Gratis</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-[#1a1a1a]">
                        kr {row.total}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={row.url}
                        className="inline-block rounded-lg bg-[#2D6A4F] px-4 py-2 text-xs font-medium text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50"
                        aria-disabled={!row.inStock}
                        tabIndex={row.inStock ? 0 : -1}
                      >
                        Gå til butikk
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
                  isBest
                    ? "border-[#B8E04A] bg-[#f0f9e8]"
                    : "border-[#e0ddd4] bg-white"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-lg">🇳🇴</span>
                    <span className="font-semibold text-[#1a1a1a]">{row.name}</span>
                    {isBest && (
                      <span className="rounded-full bg-[#B8E04A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E3D2F]">
                        Beste deal
                      </span>
                    )}
                  </div>
                  <StockDot inStock={row.inStock} />
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 text-xs text-[#666]">
                  <div>
                    <div className="uppercase tracking-wider">Pris</div>
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
                  className="block w-full rounded-lg bg-[#2D6A4F] py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                >
                  Gå til butikk
                </a>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-[#888]">
          Fraktgrenser varierer per butikk. Prisene inkluderer 25% MVA.
        </p>
      </div>
    </section>
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

// ── Landed Cost Calculator ───────────────────────────────────────────────────

export function LandedCostCalculator() {
  const [discPrice, setDiscPrice] = useState("");
  const [shipping, setShipping] = useState("");

  const discNum = parseFloat(discPrice) || 0;
  const shipNum = parseFloat(shipping) || 0;
  const total = discNum > 0 ? discNum + shipNum : null;

  return (
    <section className="w-full bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Fraktskalkulator
        </h2>
        <p className="mb-6 text-sm text-[#666]">
          Beregn totalkostnad inkl. frakt fra hvilken som helst norsk discgolf-butikk.
        </p>

        <div className="rounded-2xl border border-[#e0ddd4] bg-[#F5F2EB] p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Disc price */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#666]">
                Diskpris (NOK)
              </label>
              <input
                type="number"
                min="0"
                placeholder="f.eks. 249"
                value={discPrice}
                onChange={(e) => setDiscPrice(e.target.value)}
                className="w-full rounded-xl border border-[#ddd] bg-white px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:border-[#2D6A4F]"
              />
            </div>

            {/* Shipping */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#666]">
                Frakt (NOK)
              </label>
              <input
                type="number"
                min="0"
                placeholder="f.eks. 99"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                className="w-full rounded-xl border border-[#ddd] bg-white px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          {/* Results */}
          {total != null ? (
            <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <CalcLine label="Diskpris" value={`kr ${discNum}`} />
                <CalcLine
                  label="Frakt"
                  value={shipNum > 0 ? `kr ${shipNum}` : "Gratis"}
                />
                <CalcLine label="Total" value={`kr ${total}`} highlight />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#e8e8e4] pt-4">
                <span className="text-sm font-semibold uppercase tracking-wider text-[#666]">
                  Total
                </span>
                <span className="font-serif text-3xl font-bold text-[#2D6A4F]">
                  kr {total}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border-2 border-dashed border-[#d8d4c8] p-8 text-center text-sm text-[#aaa]">
              Skriv inn en diskpris over for å beregne totalkostnad inkl. frakt
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CalcLine({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[#888]">{label}</div>
      <div
        className={`mt-0.5 font-semibold ${
          highlight
            ? "text-[#2D6A4F]"
            : warn
            ? "text-[#C05621]"
            : "text-[#1a1a1a]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ── Price History Chart ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PriceHistoryChart({ priceHistory: _ }: { priceHistory: (number | null)[] }) {
  return (
    <section className="w-full bg-[#F5F2EB] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Prishistorikk
        </h2>
        <p className="mt-4 rounded-2xl border border-[#e0ddd4] bg-white px-6 py-8 text-center text-sm text-[#aaa]">
          Prishistorikk kommer snart — vi samler inn data daglig.
        </p>
      </div>
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
    { id: "slow",   label: "Sakte arm",  sub: "< 60 km/h",  color: "#4CAF82", distF: 0.46, turnF: 0.15, fadeF: 0.75 },
    { id: "medium", label: "Medium arm", sub: "60–80 km/h", color: "#E8A838", distF: 0.68, turnF: 0.60, fadeF: 0.90 },
    { id: "fast",   label: "Rask arm",   sub: "80+ km/h",   color: "#E8704A", distF: 1.00, turnF: 1.00, fadeF: 1.00 },
  ] as const;

  function calcCurve(arm: (typeof arms)[number]) {
    const distM = Math.min(baseM * arm.distF, 150);
    // Negative turn → drifts right (+x). Positive fade → hooks left (−x).
    const turnM  = -flight.turn * 6 * arm.turnF;
    const fadeM  = -flight.fade * 5 * arm.fadeF;
    const endLat = turnM + fadeM;
    const peakTurn = turnM * 1.1; // turn peak slightly exaggerated at apex

    const p0x = cx,                          p0y = baseY;
    const p1x = cx,                          p1y = baseY - distM * scale * 0.35;
    const p2x = cx + peakTurn * scale,       p2y = baseY - distM * scale * 0.65;
    const p3x = cx + endLat   * scale,       p3y = baseY - distM * scale;

    return { d: `M ${p0x} ${p0y} C ${p1x} ${p1y} ${p2x} ${p2y} ${p3x} ${p3y}`, endX: p3x, endY: p3y };
  }

  const yTicks = [50, 100, 150];
  const xTicks = [-30, -20, -10, 0, 10, 20, 30];

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
                  <text x={x} y={baseY + 14} textAnchor="middle"
                    fontSize="8" fill="#2D6A4F" fontFamily="system-ui,sans-serif">
                    {m === 0 ? "0" : m > 0 ? `+${m}m` : `${m}m`}
                  </text>
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

// ── Price Alert Signup ───────────────────────────────────────────────────────

export function PriceAlertSignup({ discName }: { discName: string }) {
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !consent) return;
    setSubmitted(true);
  }

  return (
    <section className="w-full bg-white px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl bg-[#1E3D2F] px-6 py-8 sm:px-10">
          {submitted ? (
            <div className="text-center">
              <div className="mb-3 text-4xl">✓</div>
              <h3 className="font-serif text-2xl font-semibold text-[#F5F2EB]">
                Varsel opprettet!
              </h3>
              <p className="mt-2 text-sm text-[#9DC08B]">
                Vi sender deg en e-post når {discName} går under ønsket pris.
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 font-serif text-2xl font-semibold text-[#F5F2EB]">
                Bli varslet
              </h2>
              <p className="mb-6 text-sm text-[#9DC08B]">
                Vi sender deg en e-post når denne disken går under ønsket pris.
              </p>
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
                    Ønsket pris (kr)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="f.eks. 200"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#F5F2EB] placeholder:text-[#9DC08B]/60 outline-none focus:border-[#B8E04A]/60"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#9DC08B]">
                    E-postadresse
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#F5F2EB] placeholder:text-[#9DC08B]/60 outline-none focus:border-[#B8E04A]/60"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="submit"
                    disabled={!consent}
                    className="w-full rounded-xl bg-[#B8E04A] px-5 py-3 text-sm font-semibold text-[#1E3D2F] transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Varsle meg når prisen synker
                  </button>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-3">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#B8E04A]"
                  />
                  <span className="text-xs leading-relaxed text-[#9DC08B]/80">
                    Jeg godtar at DiscDrop lagrer e-postadressen min for å sende prisvarsler. Se vår{" "}
                    <a
                      href="/personvern"
                      className="underline underline-offset-2 hover:text-[#B8E04A] transition-colors"
                    >
                      personvernserklæring
                    </a>
                    .
                  </span>
                </label>
              </form>
              <p className="mt-4 text-xs text-[#9DC08B]/70">
                Vi sender bare e-post når prisen synker. Aldri spam.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
