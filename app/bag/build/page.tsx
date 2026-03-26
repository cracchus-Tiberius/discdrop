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

// ── Types ──────────────────────────────────────────────────────────────────

type SkillLevel = WizardAnswers["skillLevel"];
type ArmSpeed = WizardAnswers["armSpeed"];
type DiscType = "drivers" | "midrange" | "putters" | "full-bag";
type BudgetOption = "under-500" | "500-1500" | "1500-3000" | "no-limit";
type CourseType = "wooded" | "open" | "mixed" | "all";

// ── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const fillPct = Math.round((step / total) * 100);
  const discPct = Math.round(((step - 1) / (total - 1)) * 100);
  return (
    <div className="relative mb-8 pt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e4]">
        <div
          className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500 ease-out"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      {/* Flying disc */}
      <div
        className="absolute -top-0.5 transition-all duration-500 ease-out"
        style={{ left: `calc(${discPct}% - 8px)` }}
        aria-hidden
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="13" rx="10" ry="4.5" fill="#2D6A4F" />
          <ellipse cx="12" cy="11.5" rx="5" ry="2.5" fill="#B8E04A" />
          <ellipse cx="12" cy="10.5" rx="2" ry="1.2" fill="#F5F2EB" opacity="0.7" />
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[#aaa]">
        <span>Step {step} of {total}</span>
        <span>{fillPct}%</span>
      </div>
    </div>
  );
}

// ── Option card ────────────────────────────────────────────────────────────

function OptionCard({
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
      className={`w-full rounded-xl border-2 px-5 py-4 text-left transition-all duration-150 ease-out ${
        selected
          ? "border-[#2D6A4F] bg-[#f0f9e8] shadow-sm"
          : "border-[#e8e8e4] bg-white hover:border-[#2D6A4F]/40 hover:bg-[#fafaf8]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Multi-select card ──────────────────────────────────────────────────────

function MultiCard({
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
      className={`relative w-full rounded-xl border-2 px-5 py-4 text-left transition-all duration-150 ease-out ${
        selected
          ? "border-[#2D6A4F] bg-[#f0f9e8] shadow-sm"
          : "border-[#e8e8e4] bg-white hover:border-[#2D6A4F]/40 hover:bg-[#fafaf8]"
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2D6A4F] text-white text-[10px]">
          ✓
        </span>
      )}
      {children}
    </button>
  );
}

// ── Back button ────────────────────────────────────────────────────────────

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
      Back
    </button>
  );
}

// ── Continue button ────────────────────────────────────────────────────────

function ContinueBtn({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-[#2D6A4F] px-6 py-3.5 text-base font-medium text-white transition-all duration-150 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── Arm speed flight arc visual ────────────────────────────────────────────

function ArmSpeedVisual({ selected }: { selected: ArmSpeed | null }) {
  const arcs: { speed: ArmSpeed; label: string; color: string; d: string }[] = [
    {
      speed: "slow",
      label: "Slow",
      color: "#3B82F6",
      d: "M 10 65 C 30 20 80 5 120 35 C 150 55 160 85 160 90",
    },
    {
      speed: "medium",
      label: "Medium",
      color: "#2D6A4F",
      d: "M 10 65 C 30 10 90 15 130 45 C 155 65 170 90 175 90",
    },
    {
      speed: "fast",
      label: "Fast",
      color: "#E8704A",
      d: "M 10 65 C 35 5 105 20 145 55 C 165 75 185 90 190 90",
    },
  ];

  return (
    <div className="mb-6 rounded-xl bg-[#f5f5f3] p-4">
      <svg viewBox="0 0 200 100" className="w-full" aria-hidden>
        {arcs.map(({ speed, color, d }) => (
          <path
            key={speed}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={selected === speed ? 3 : 1.5}
            strokeDasharray={selected && selected !== speed ? "4 3" : undefined}
            opacity={selected && selected !== speed ? 0.35 : 1}
          />
        ))}
        {/* Throw start */}
        <circle cx="10" cy="65" r="4" fill="#888" />
        <text x="4" y="82" fontSize="7" fill="#888" fontFamily="system-ui,sans-serif">Release</text>
        {/* Labels */}
        {arcs.map(({ speed, label, color, d }) => {
          const endX = speed === "slow" ? 162 : speed === "medium" ? 177 : 192;
          return (
            <text
              key={speed}
              x={endX}
              y={92}
              fontSize="8"
              fill={selected === speed ? color : "#bbb"}
              fontFamily="system-ui,sans-serif"
              textAnchor="end"
              fontWeight={selected === speed ? "600" : "400"}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[10px] text-[#aaa]">
        Arm speed affects which discs will fly as intended for you
      </p>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4">
      <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-85" style={{ gap: 10 }}>
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
        <span className="flex items-center gap-1.5 rounded-full bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#B8E04A]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Build My Bag
        </span>
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

// ── Summary row for review ─────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e8e8e4] bg-white px-5 py-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[#aaa]">{label}</div>
        <div className="mt-0.5 text-sm font-medium text-[#1a1a1a]">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-sm font-medium text-[#2D6A4F] transition-colors hover:text-[#1E4D3A]"
      >
        Edit
      </button>
    </div>
  );
}

// ── Wizard ─────────────────────────────────────────────────────────────────

export default function BuildBagPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [armSpeed, setArmSpeed] = useState<ArmSpeed | null>(null);
  const [discTypes, setDiscTypes] = useState<DiscType[]>([]);
  const [budget, setBudget] = useState<BudgetOption | null>(null);
  const [ownedDiscs, setOwnedDiscs] = useState("");
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const TOTAL_STEPS = 7;

  function next() { setStep((s) => s + 1); }
  function back() { setStep((s) => Math.max(1, s - 1)); }
  function goTo(n: number) { setStep(n); }

  function toggleDiscType(t: DiscType) {
    if (t === "full-bag") {
      setDiscTypes((prev) => prev.includes("full-bag") ? [] : ["full-bag"]);
      return;
    }
    setDiscTypes((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t && x !== "full-bag")
        : [...prev.filter((x) => x !== "full-bag"), t]
    );
  }

  function toggleCourseType(t: CourseType) {
    if (t === "all") {
      setCourseTypes((prev) => prev.includes("all") ? [] : ["all"]);
      return;
    }
    setCourseTypes((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t && x !== "all")
        : [...prev.filter((x) => x !== "all"), t]
    );
  }

  async function handleBuild() {
    if (!skillLevel || !armSpeed || !budget) return;

    const answers: WizardAnswers = {
      skillLevel,
      armSpeed,
      discTypes,
      budget,
      ownedDiscs,
      courseTypes,
    };

    setIsLoading(true);
    setBuildError(null);

    try {
      const res = await fetch("/api/bag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      if (!res.ok) {
        throw new Error("API error");
      }

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

  // Labels for review
  const skillLabels: Record<SkillLevel, string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    pro: "Pro / Elite",
  };
  const armLabels: Record<ArmSpeed, string> = {
    slow: "Slow — under 70 km/h",
    medium: "Medium — 70–90 km/h",
    fast: "Fast — 90+ km/h",
  };
  const discTypeLabels: Record<DiscType, string> = {
    drivers: "Drivers",
    midrange: "Mid-range",
    putters: "Putters",
    "full-bag": "Full bag mix",
  };
  const budgetLabels: Record<BudgetOption, string> = {
    "under-500": "Under kr 500",
    "500-1500": "kr 500–1 500",
    "1500-3000": "kr 1 500–3 000",
    "no-limit": "No limit",
  };
  const courseLabels: Record<CourseType, string> = {
    wooded: "Wooded",
    open: "Open field",
    mixed: "Mixed",
    all: "All types",
  };

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
          <ProgressBar step={step} total={TOTAL_STEPS} />

          {/* ── Step 1: Skill level ── */}
          {step === 1 && (
            <div key={1} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                What&apos;s your skill level?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Be honest — the right discs at your level make a huge difference.
              </p>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "beginner" as const, label: "Beginner", desc: "Just started, still learning to throw consistently" },
                    { value: "intermediate" as const, label: "Intermediate", desc: "Can throw 60–80m, know the fundamentals" },
                    { value: "advanced" as const, label: "Advanced", desc: "Plays competitively, shapes shots regularly" },
                    { value: "pro" as const, label: "Pro / Elite", desc: "Tournament player, touring or sponsored" },
                  ]
                ).map(({ value, label, desc }) => (
                  <OptionCard
                    key={value}
                    selected={skillLevel === value}
                    onClick={() => { setSkillLevel(value); setTimeout(next, 180); }}
                  >
                    <div className="font-medium text-[#1a1a1a]">{label}</div>
                    <div className="mt-0.5 text-sm text-[#888]">{desc}</div>
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Arm speed ── */}
          {step === 2 && (
            <div key={2} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                How fast is your arm?
              </h2>
              <p className="mb-4 text-sm text-[#666]">
                Arm speed determines which discs will fly as intended for you.
              </p>
              <ArmSpeedVisual selected={armSpeed} />
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "slow" as const, label: "Slow — under 70 km/h", desc: "Understable discs fly straight; overstable discs go right immediately" },
                    { value: "medium" as const, label: "Medium — 70–90 km/h", desc: "Most discs fly close to their rated flight path" },
                    { value: "fast" as const, label: "Fast — 90+ km/h", desc: "Can handle overstable discs; understable discs will hyzer-flip" },
                  ]
                ).map(({ value, label, desc }) => (
                  <OptionCard
                    key={value}
                    selected={armSpeed === value}
                    onClick={() => { setArmSpeed(value); setTimeout(next, 180); }}
                  >
                    <div className="font-medium text-[#1a1a1a]">{label}</div>
                    <div className="mt-0.5 text-sm text-[#888]">{desc}</div>
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Disc types ── */}
          {step === 3 && (
            <div key={3} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                What discs do you want?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Select all that apply, or choose full bag for a balanced recommendation.
              </p>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "drivers" as const, label: "Drivers", desc: "Distance and fairway drivers for longer shots" },
                    { value: "midrange" as const, label: "Mid-range", desc: "Versatile discs for approach and mid-distance" },
                    { value: "putters" as const, label: "Putters", desc: "Approach putters and putting discs" },
                    { value: "full-bag" as const, label: "Full bag mix", desc: "A balanced bag covering all distances" },
                  ]
                ).map(({ value, label, desc }) => (
                  <MultiCard
                    key={value}
                    selected={discTypes.includes(value)}
                    onClick={() => toggleDiscType(value)}
                  >
                    <div className="pr-6 font-medium text-[#1a1a1a]">{label}</div>
                    <div className="mt-0.5 text-sm text-[#888]">{desc}</div>
                  </MultiCard>
                ))}
              </div>
              <div className="mt-6">
                <ContinueBtn onClick={next} />
              </div>
            </div>
          )}

          {/* ── Step 4: Budget ── */}
          {step === 4 && (
            <div key={4} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                What&apos;s your budget?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                We&apos;ll size your bag to fit within your range.
              </p>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "under-500" as const, label: "Under kr 500", desc: "3–4 discs — a starter set to get going" },
                    { value: "500-1500" as const, label: "kr 500–1 500", desc: "7–9 discs — a solid beginner or practice bag" },
                    { value: "1500-3000" as const, label: "kr 1 500–3 000", desc: "10–12 discs — a well-rounded playing bag" },
                    { value: "no-limit" as const, label: "No limit", desc: "Full bag — 13–15 discs for every situation" },
                  ]
                ).map(({ value, label, desc }) => (
                  <OptionCard
                    key={value}
                    selected={budget === value}
                    onClick={() => { setBudget(value); setTimeout(next, 180); }}
                  >
                    <div className="font-medium text-[#1a1a1a]">{label}</div>
                    <div className="mt-0.5 text-sm text-[#888]">{desc}</div>
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Discs already owned ── */}
          {step === 5 && (
            <div key={5} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Discs you already own
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Optional — list discs you already have so we can note them. This will be used to
                avoid duplicates in a future version.
              </p>
              <textarea
                value={ownedDiscs}
                onChange={(e) => setOwnedDiscs(e.target.value)}
                placeholder="e.g. Innova Aviar, Discraft Buzzz, Innova Destroyer…"
                rows={4}
                className="w-full resize-none rounded-xl border border-[#ddd] bg-[#fafaf8] px-4 py-3 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#2D6A4F]"
              />
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={next}
                  className="flex-1 rounded-xl border border-[#ddd] bg-white px-6 py-3 text-sm font-medium text-[#666] transition-all hover:border-[#2D6A4F]/40"
                >
                  Skip
                </button>
                <ContinueBtn onClick={next} />
              </div>
            </div>
          )}

          {/* ── Step 6: Course types ── */}
          {step === 6 && (
            <div key={6} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                What courses do you play?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Course type influences whether you need more mids and putters or more drivers.
              </p>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "wooded" as const, label: "Wooded / Tight", desc: "Short holes with lots of trees — accuracy over distance" },
                    { value: "open" as const, label: "Open / Links", desc: "Wide fairways where distance and wind resistance matter" },
                    { value: "mixed" as const, label: "Mixed", desc: "A bit of both — typical tournament layout" },
                    { value: "all" as const, label: "All types", desc: "I play a variety of different courses" },
                  ]
                ).map(({ value, label, desc }) => (
                  <MultiCard
                    key={value}
                    selected={courseTypes.includes(value)}
                    onClick={() => toggleCourseType(value)}
                  >
                    <div className="pr-6 font-medium text-[#1a1a1a]">{label}</div>
                    <div className="mt-0.5 text-sm text-[#888]">{desc}</div>
                  </MultiCard>
                ))}
              </div>
              <div className="mt-6">
                <ContinueBtn onClick={next} />
              </div>
            </div>
          )}

          {/* ── Step 7: Review ── */}
          {step === 7 && (
            <div key={7} style={{ animation: "slideInRight 300ms ease forwards" }}>
              <div className="mb-5">
                <BackBtn onClick={back} />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-[#1a1a1a]">
                Ready to build your bag?
              </h2>
              <p className="mb-6 text-sm text-[#666]">
                Review your answers below. Click Edit to go back and change anything.
              </p>

              <div className="flex flex-col gap-3">
                <SummaryRow
                  label="Skill level"
                  value={skillLevel ? skillLabels[skillLevel] : "—"}
                  onEdit={() => goTo(1)}
                />
                <SummaryRow
                  label="Arm speed"
                  value={armSpeed ? armLabels[armSpeed] : "—"}
                  onEdit={() => goTo(2)}
                />
                <SummaryRow
                  label="Disc types"
                  value={
                    discTypes.length > 0
                      ? discTypes.map((t) => discTypeLabels[t]).join(", ")
                      : "Full bag mix"
                  }
                  onEdit={() => goTo(3)}
                />
                <SummaryRow
                  label="Budget"
                  value={budget ? budgetLabels[budget] : "—"}
                  onEdit={() => goTo(4)}
                />
                <SummaryRow
                  label="Discs owned"
                  value={ownedDiscs.trim() || "None listed"}
                  onEdit={() => goTo(5)}
                />
                <SummaryRow
                  label="Course types"
                  value={
                    courseTypes.length > 0
                      ? courseTypes.map((t) => courseLabels[t]).join(", ")
                      : "Not specified"
                  }
                  onEdit={() => goTo(6)}
                />
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={!skillLevel || !armSpeed || !budget}
                  className="w-full rounded-xl bg-[#B8E04A] px-6 py-4 text-base font-semibold text-[#1E3D2F] transition-all duration-150 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Build my bag →
                </button>
                {(!skillLevel || !armSpeed || !budget) && (
                  <p className="mt-2 text-center text-xs text-[#E8704A]">
                    Go back and complete all required steps first.
                  </p>
                )}
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
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] py-6 text-center text-xs text-[#888]">
        DiscDrop — disc golf prices in Norway
      </footer>
    </div>
  );
}
