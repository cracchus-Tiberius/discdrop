"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { StoredBag, GeneratedDisc, WizardAnswers } from "@/app/bag/[id]/BagPageClient";

// ── API types ──────────────────────────────────────────────────────────────

type ApiDisc = {
  name: string;
  brand: string;
  type: string;
  plastic: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  priceNOK: number;
  reason: string;
  slug: string;
};

type BagApiResponse = {
  summary: string;
  discs: ApiDisc[];
  bagTips: string;
};

function apiTypeToCategory(type: string, speed: number): GeneratedDisc["category"] {
  const t = type.toLowerCase();
  if (t.includes("putter")) return "putter";
  if (t.includes("midrange") || t.includes("mid")) return "midrange";
  if (speed >= 9) return "driver";
  if (speed >= 6) return "fairway";
  return "midrange";
}

function randomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { num: 1, label: "Nivå" },
    { num: 2, label: "Kasteteknikk" },
    { num: 3, label: "Behov" },
    { num: 4, label: "Preferanser" },
  ];

  return (
    <div className="relative mb-8">
      {/* Track */}
      <div className="absolute left-4 right-4 top-4 h-0.5 bg-[#e8e8e4]">
        <div
          className="h-full bg-[#2D6A4F] transition-all duration-500 ease-out"
          style={{ width: `${((step - 1) / 3) * 100}%` }}
        />
      </div>
      {/* Circles + labels */}
      <div className="relative flex justify-between">
        {steps.map((s) => {
          const done = step > s.num;
          const active = step === s.num;
          return (
            <div key={s.num} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  done
                    ? "bg-[#2D6A4F] text-white"
                    : active
                    ? "bg-[#2D6A4F] text-white shadow-[0_0_0_4px_rgba(45,106,79,0.15)]"
                    : "border-2 border-[#ddd] bg-white text-[#bbb]"
                }`}
              >
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-none ${
                  step >= s.num ? "text-[#2D6A4F]" : "text-[#bbb]"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Selection card (single-select) ─────────────────────────────────────────

function SelectCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[80px] w-full rounded-xl border-2 px-4 py-4 text-left transition-all duration-150 ${
        selected
          ? "border-[#2D6A4F] bg-[#f0f9e8]"
          : "border-[#e8e8e4] bg-white hover:border-[#2D6A4F]/40 hover:bg-[#fafaf8]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Pill button ─────────────────────────────────────────────────────────────

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-150 ${
        selected
          ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
          : "border-[#e8e8e4] bg-white text-[#444] hover:border-[#2D6A4F]/40"
      }`}
    >
      {children}
    </button>
  );
}

// ── Nav buttons ─────────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#888] transition-colors hover:text-[#1a1a1a]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      Tilbake
    </button>
  );
}

function NextBtn({
  onClick,
  disabled,
  label = "Neste →",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-[#2D6A4F] px-6 py-3.5 text-base font-medium text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 relative flex w-full items-center bg-[#1E3D2F] px-8 py-4 shadow-sm">
      <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-85" style={{ gap: 10 }}>
        <Image src="/discdrop-logo-dark.svg" alt="DiscDrop" width={170} height={36} className="h-[28px] w-auto md:h-[36px]" />
      </Link>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-[#9DC08B] md:flex">
        <Link href="/" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Hjem</Link>
        <a href="/#hot-drops" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Hot Drops</a>
        <Link href="/browse" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">Alle disker</Link>
        <Link href="/bag/build" className="rounded-full px-3.5 py-1.5 bg-white/15 font-medium text-white">
          Bygg min bag
        </Link>
      </div>
    </nav>
  );
}

// ── Wizard ─────────────────────────────────────────────────────────────────

export default function BuildBagPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1 — Nivå
  const [level, setLevel] = useState<WizardAnswers["level"] | null>(null);

  // Step 2 — Kasteteknikk
  const [throwingStyle, setThrowingStyle] = useState<WizardAnswers["throwingStyle"] | null>(null);

  // Step 3 — Behov (multi)
  const [needs, setNeeds] = useState<string[]>([]);

  // Step 4 — Preferanser
  const [budget, setBudget] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [discCount, setDiscCount] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  function next() { setStep((s) => s + 1); }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  function toggleNeed(n: string) {
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function toggleBrand(b: string) {
    if (b === "no-preference") {
      setBrands((prev) => (prev.includes("no-preference") ? [] : ["no-preference"]));
      return;
    }
    setBrands((prev) =>
      prev.includes(b)
        ? prev.filter((x) => x !== b && x !== "no-preference")
        : [...prev.filter((x) => x !== "no-preference"), b]
    );
  }

  async function handleBuild() {
    if (!level || !throwingStyle) return;

    const answers: WizardAnswers = {
      level,
      throwingStyle,
      needs,
      budget,
      brands,
      discCount,
    };

    setIsLoading(true);
    setBuildError(null);

    try {
      const res = await fetch("/api/bag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      if (!res.ok) throw new Error("API error");

      const data: BagApiResponse = await res.json();

      const generated: GeneratedDisc[] = data.discs.map((d) => ({
        id: d.slug,
        name: d.name,
        brand: d.brand,
        type: d.type,
        flight: { speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade },
        category: apiTypeToCategory(d.type, d.speed),
        quantity: 1 as const,
        reason: d.reason,
        priceNOK: d.priceNOK,
      }));

      const id = randomId();
      const stored: StoredBag = {
        answers,
        discs: generated,
        generatedAt: Date.now(),
        summary: data.summary,
        bagTips: data.bagTips,
      };
      localStorage.setItem(`discdrop_bag_${id}`, JSON.stringify(stored));
      router.push(`/bag?id=${id}`);
    } catch {
      setBuildError("Noe gikk galt. Prøv igjen.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F2EB]">
        <div className="flex flex-col items-center gap-6">
          <svg width="64" height="64" viewBox="0 0 24 24" className="animate-spin" aria-hidden fill="none">
            <ellipse cx="12" cy="14" rx="10" ry="4.5" fill="#2D6A4F" />
            <ellipse cx="12" cy="12" rx="5" ry="2.5" fill="#B8E04A" />
            <ellipse cx="12" cy="10.5" rx="2" ry="1.2" fill="#F5F2EB" opacity="0.7" />
          </svg>
          <p className="font-serif text-2xl font-semibold text-[#2D6A4F]">Bygger din bag...</p>
          <p className="text-sm text-[#888]">Dette tar noen sekunder</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F2EB]">
      <Navbar />
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-[#e0ddd4] bg-white p-8 shadow-sm">
          <StepIndicator step={step} />

          {/* ── Step 1: Nivå ── */}
          {step === 1 && (
            <div key={1} style={{ animation: "fadeIn 250ms ease forwards" }}>
              <h2 className="mb-1.5 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Hva er ditt spillnivå?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Vær ærlig — riktige disker for ditt nivå utgjør en enorm forskjell.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "beginner" as const, label: "Nybegynner", desc: "Under 1 år med erfaring" },
                    { value: "intermediate" as const, label: "Middels", desc: "1–3 år, kaster ca. 60–80m" },
                    { value: "advanced" as const, label: "Avansert", desc: "3+ år, kaster 80m+" },
                    { value: "pro" as const, label: "Pro / Elite", desc: "Turneringsspiller, tourer eller sponset" },
                  ]
                ).map(({ value, label, desc }) => (
                  <SelectCard
                    key={value}
                    selected={level === value}
                    onClick={() => setLevel(value)}
                  >
                    <div className="font-semibold text-[#1a1a1a]">{label}</div>
                    <div className="mt-1 text-xs leading-snug text-[#888]">{desc}</div>
                  </SelectCard>
                ))}
              </div>
              <div className="mt-6">
                <NextBtn onClick={next} disabled={!level} />
              </div>
            </div>
          )}

          {/* ── Step 2: Kasteteknikk ── */}
          {step === 2 && (
            <div key={2} style={{ animation: "fadeIn 250ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-1.5 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Hva er din kastestil?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Dette påvirker hvilke disker som passer din teknikk.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "rhbh" as const, label: "Høyre backhand", sub: "RHBH", desc: "Vanligst" },
                    { value: "lhbh" as const, label: "Venstre backhand", sub: "LHBH", desc: "Speilvendt" },
                    { value: "forehand" as const, label: "Primært forehand", sub: "Flick / sidearm", desc: "" },
                    { value: "both" as const, label: "Begge", sub: "Allsidig", desc: "Bruker begge" },
                  ]
                ).map(({ value, label, sub, desc }) => (
                  <SelectCard
                    key={value}
                    selected={throwingStyle === value}
                    onClick={() => setThrowingStyle(value)}
                  >
                    <div className="font-semibold text-[#1a1a1a]">{label}</div>
                    <div className="mt-1 text-xs leading-snug text-[#888]">
                      {sub}{desc ? ` — ${desc}` : ""}
                    </div>
                  </SelectCard>
                ))}
              </div>
              <div className="mt-6">
                <NextBtn onClick={next} disabled={!throwingStyle} />
              </div>
            </div>
          )}

          {/* ── Step 3: Behov ── */}
          {step === 3 && (
            <div key={3} style={{ animation: "fadeIn 250ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-1.5 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Hva trenger du?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Velg ett eller flere områder du vil forbedre.
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "distance", label: "Mer distanse" },
                    { value: "precision", label: "Bedre presisjon" },
                    { value: "approach", label: "Sterkere innspill" },
                    { value: "putting", label: "Sikrere putting" },
                    { value: "wind", label: "Disker for vind" },
                    { value: "full-bag", label: "Komplett bag" },
                  ]
                ).map(({ value, label }) => (
                  <Pill
                    key={value}
                    selected={needs.includes(value)}
                    onClick={() => toggleNeed(value)}
                  >
                    {label}
                  </Pill>
                ))}
              </div>
              <div className="mt-8">
                <NextBtn onClick={next} disabled={needs.length === 0} />
              </div>
            </div>
          )}

          {/* ── Step 4: Preferanser ── */}
          {step === 4 && (
            <div key={4} style={{ animation: "fadeIn 250ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-1.5 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Noen siste preferanser?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Valgfritt — hjelper oss å gi bedre forslag.
              </p>

              {/* Budget */}
              <div className="mb-6">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#aaa]">Budsjett</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "under-500", label: "Under kr 500" },
                      { value: "500-1000", label: "kr 500–1000" },
                      { value: "1000+", label: "kr 1000+" },
                      { value: "doesnt-matter", label: "Spiller ingen rolle" },
                    ]
                  ).map(({ value, label }) => (
                    <Pill key={value} selected={budget === value} onClick={() => setBudget(budget === value ? null : value)}>
                      {label}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Favorittmerke */}
              <div className="mb-6">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#aaa]">Favorittmerke</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "innova", label: "Innova" },
                      { value: "discmania", label: "Discmania" },
                      { value: "kastaplast", label: "Kastaplast" },
                      { value: "mvp", label: "MVP" },
                      { value: "discraft", label: "Discraft" },
                      { value: "latitude64", label: "Latitude 64" },
                      { value: "no-preference", label: "Ingen preferanse" },
                    ]
                  ).map(({ value, label }) => (
                    <Pill key={value} selected={brands.includes(value)} onClick={() => toggleBrand(value)}>
                      {label}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Antall disker */}
              <div className="mb-8">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#aaa]">Antall disker</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "3-5", label: "3–5 starter" },
                      { value: "6-10", label: "6–10 standard" },
                      { value: "10+", label: "10+ turneringsbag" },
                    ]
                  ).map(({ value, label }) => (
                    <Pill key={value} selected={discCount === value} onClick={() => setDiscCount(discCount === value ? null : value)}>
                      {label}
                    </Pill>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleBuild}
                className="w-full rounded-xl bg-[#B8E04A] px-6 py-4 text-base font-semibold text-[#1E3D2F] transition-all duration-150 hover:brightness-110"
              >
                Vis forslag →
              </button>

              {buildError && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#E8704A]/30 bg-[#fdf4f1] px-4 py-3">
                  <p className="text-sm text-[#E8704A]">{buildError}</p>
                  <button
                    type="button"
                    onClick={handleBuild}
                    className="shrink-0 text-sm font-medium text-[#E8704A] underline"
                  >
                    Prøv igjen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[#999]">
          <span>© 2026 DiscDrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#444]">Personvern</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#444]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
