"use client";

// components/PriceAlertInline.tsx — compact "Varsle meg når [disk] er under
// [X] kr" strip shown under the Prisfall card grid. Wired to the same
// POST /api/alerts endpoint (and GDPR consent pattern) as the full
// PriceAlertSignup form on the disc detail page
// (app/disc/[slug]/DiscDetailClient.tsx) — one alert, no account, no
// newsletter, per that endpoint's contract.
// Design spec: Claude Design project "DiscDrop Redesign",
// design_handoff_prisfall/README.md, "Skjerm 3".

import { useState } from "react";

export type AlertDiscOption = {
  discId: string;
  name: string;
  brand: string;
  newPrice: number;
};

function suggestedThreshold(price: number): number {
  return Math.max(10, Math.round((price * 0.9) / 10) * 10);
}

export function PriceAlertInline({ discs }: { discs: AlertDiscOption[] }) {
  const [discId, setDiscId] = useState(discs[0]?.discId ?? "");
  const selected = discs.find((d) => d.discId === discId) ?? discs[0];

  const [threshold, setThreshold] = useState(() =>
    selected ? String(suggestedThreshold(selected.newPrice)) : ""
  );
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (discs.length === 0 || !selected) return null;

  function handleDiscChange(id: string) {
    setDiscId(id);
    const disc = discs.find((d) => d.discId === id);
    if (disc) setThreshold(String(suggestedThreshold(disc.newPrice)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showEmail) {
      setShowEmail(true);
      return;
    }
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
          targetPrice: threshold ? Number(threshold) : 0,
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

  if (submitted) {
    return (
      <div className="mt-5 flex items-center gap-4 rounded-2xl border-2 border-[#101C14] bg-[#101C14] px-5 py-4 shadow-[4px_4px_0_#B8E04A]">
        <span className="dd-sticker shrink-0">Varsel er på ✓</span>
        <p className="text-sm text-[#FFFDF6]/80">
          Vi sier fra når {selected.name} er under {threshold} kr.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 flex flex-col gap-4 rounded-2xl border-2 border-[#101C14] bg-[#101C14] px-5 py-4 text-[#FFFDF6] shadow-[4px_4px_0_#B8E04A] md:flex-row md:items-center md:gap-5"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1E3D2F]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8E04A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <p className="text-[17px] font-extrabold tracking-[-0.02em]">Varsle meg når</p>
          <p className="text-xs text-[#FFFDF6]/50">Vi sender én e-post. Ingen nyhetsbrev, ingen konto.</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <select
          value={discId}
          onChange={(e) => handleDiscChange(e.target.value)}
          className="min-h-[44px] flex-1 rounded-xl bg-[#FFFDF6] px-3.5 py-[11px] text-[15px] font-bold text-[#101C14] outline-none sm:flex-none sm:min-w-[180px]"
        >
          {discs.map((d) => (
            <option key={d.discId} value={d.discId}>
              {d.brand} {d.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2.5">
          <span className="text-[15px] font-bold text-[#FFFDF6]/80">er under</span>
          <div className="flex min-h-[44px] items-center gap-1 rounded-xl bg-[#FFFDF6] px-4 py-[11px]">
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-16 bg-transparent text-[17px] font-extrabold text-[#101C14] outline-none"
            />
            <span className="text-sm font-semibold text-[#101C1499]">kr</span>
          </div>
        </div>

        {showEmail && (
          <div className="flex flex-1 flex-col gap-2 sm:min-w-[220px] sm:flex-row sm:items-center">
            <input
              type="email"
              required
              autoFocus
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-[11px] text-sm text-[#FFFDF6] placeholder:text-[#FFFDF6]/50 outline-none focus:border-[#B8E04A]/60"
            />
            <label className="flex shrink-0 cursor-pointer items-start gap-2 text-[11px] leading-snug text-[#FFFDF6]/60">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#B8E04A]"
              />
              <span>
                Godtar <a href="/personvern" className="underline underline-offset-2 hover:text-[#B8E04A]">personvernserklæringen</a>
              </span>
            </label>
          </div>
        )}
      </div>

      <button type="submit" disabled={loading || (showEmail && (!email || !consent))} className="dd-cta shrink-0 px-[22px] py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
        {loading ? "Lagrer…" : "Slå på"}
      </button>

      {error && <p className="text-xs text-[#E8704A] sm:basis-full">{error}</p>}
    </form>
  );
}
