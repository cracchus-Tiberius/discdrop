"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { discs as allDiscs } from "@/data/discs.js";
import type { StoredBag, GeneratedDisc, WizardAnswers } from "@/app/bag/[id]/BagPageClient";

// ── Bag generation ─────────────────────────────────────────────────────────

type DiscFromCatalog = (typeof allDiscs)[number];

function getDiscCategory(disc: DiscFromCatalog): GeneratedDisc["category"] {
  if (disc.type === "putter") return "putter";
  if (disc.type === "midrange") return "midrange";
  if (disc.flight.speed >= 11) return "driver";
  return "fairway";
}

function getBestNOK(disc: DiscFromCatalog): number | undefined {
  const pool = disc.stores.filter((s) => s.inStock);
  const source = pool.length ? pool : disc.stores;
  if (!source.length) return undefined;
  return Math.min(...source.map((s) => s.price));
}

function generateReason(
  disc: DiscFromCatalog,
  cat: GeneratedDisc["category"],
  answers: WizardAnswers
): string {
  const { turn, fade, speed } = disc.flight;
  const skill = answers.skillLevel;
  const arm = answers.armSpeed;
  const armStr = arm === "slow" ? "slower arm" : arm === "medium" ? "medium arm" : "fast arm";

  if (cat === "putter") {
    if (fade >= 3)
      return `Overstable utility putter — dependable in wind and tight approach lines, great for ${skill} play.`;
    return `Straight-flying putter ideal for a ${skill} building a consistent short game.`;
  }
  if (cat === "midrange") {
    if (fade >= 3)
      return `Overstable midrange for reliable fades and headwind shots — an essential tool at the ${skill} level.`;
    if (turn <= -1)
      return `Understable midrange with a gentle turn — versatile all-around disc for ${skill} players.`;
    return `Neutral midrange for accurate placement — a core workhorse disc at any skill level.`;
  }
  if (cat === "fairway") {
    if (arm === "slow" && turn <= -2)
      return `Understable fairway driver that maximises distance for a ${armStr} — will turn and glide for you.`;
    if (turn <= -2)
      return `Understable fairway driver that turns gently and adds easy distance — great for your ${armStr}.`;
    if (speed <= 7)
      return `Beginner-friendly fairway driver with predictable flight — a great first step up from a midrange.`;
    return `Accurate control fairway for tight lines and precise placement — suits your ${armStr} well.`;
  }
  // driver
  if (arm === "fast" && turn >= 0)
    return `Overstable distance driver that stays reliable under your ${armStr} — a trusted workhorse for open shots.`;
  if (arm === "fast")
    return `Distance driver that rewards your ${armStr} with maximum glide and distance.`;
  if (turn <= -1)
    return `Distance driver with slight turn — ${skill} players with a ${armStr} can get great distance from this.`;
  return `Distance driver for open field shots — best once your arm speed builds further.`;
}

function scoreDisc(disc: DiscFromCatalog, answers: WizardAnswers): number {
  const { skillLevel, armSpeed, courseTypes } = answers;
  const cat = getDiscCategory(disc);
  const { speed, turn, fade } = disc.flight;
  let score = 10;

  // Skill level
  if (skillLevel === "beginner") {
    if (cat === "driver") return -999; // exclude distance drivers entirely
    if (speed > 8) score -= 10;
    if (fade > 3) score -= 5;
    if (turn <= -2) score += 5;
  } else if (skillLevel === "intermediate") {
    if (cat === "driver" && fade >= 5) score -= 10;
    if (speed >= 12 && fade >= 4) score -= 4;
    if (turn <= -2) score += 2;
  } else {
    // advanced / pro — like overstable options too
    if (turn >= 0 && fade >= 3) score += 2;
  }

  // Arm speed for drivers/fairways
  if (cat === "driver" || cat === "fairway") {
    if (armSpeed === "slow") {
      if (turn >= 0) score -= 18;
      if (turn >= 1) score -= 30;
      if (turn <= -2) score += 8;
      if (speed >= 12) score -= 8;
    } else if (armSpeed === "medium") {
      if (turn >= 1) score -= 8;
      if (turn <= -3) score -= 3;
      if (turn === -1 || turn === -2) score += 3;
    } else {
      // fast arm
      if (turn >= 0 && fade >= 3) score += 4;
      if (turn <= -3 && cat === "driver") score -= 5;
    }
  }

  // Course type
  if (courseTypes.includes("wooded")) {
    if (cat === "driver") score -= 3;
    if (cat === "midrange") score += 4;
    if (cat === "putter") score += 2;
  }
  if (courseTypes.includes("open")) {
    if (cat === "driver" || cat === "fairway") score += 3;
  }

  return score;
}

function generateBag(answers: WizardAnswers): GeneratedDisc[] {
  const { skillLevel, discTypes, budget } = answers;

  const budgetMaxDiscs: Record<string, number> = {
    "under-500": 4,
    "500-1500": 8,
    "1500-3000": 11,
    "no-limit": 14,
  };
  const maxDiscs = budgetMaxDiscs[budget] ?? 8;

  const wantsAll =
    discTypes.length === 0 || discTypes.includes("full-bag");
  const wantsDrivers = wantsAll || discTypes.includes("drivers");
  const wantsMids = wantsAll || discTypes.includes("midrange");
  const wantsPutters = wantsAll || discTypes.includes("putters");

  type CatKey = GeneratedDisc["category"];

  let targets: Record<CatKey, number> = { driver: 0, fairway: 0, midrange: 0, putter: 0 };

  if (wantsAll) {
    targets = { driver: 2, fairway: 2, midrange: 3, putter: 3 };
  } else {
    if (wantsDrivers) { targets.driver = 2; targets.fairway = 2; }
    if (wantsMids) targets.midrange = 3;
    if (wantsPutters) targets.putter = 4;
    if (targets.putter === 0) targets.putter = 2;
    if (targets.midrange === 0 && wantsDrivers) targets.midrange = 1;
  }

  // Beginners don't use distance drivers
  if (skillLevel === "beginner") {
    targets.driver = 0;
    targets.fairway = Math.max(targets.fairway, 2);
    targets.midrange = Math.max(targets.midrange, 2);
    targets.putter = Math.max(targets.putter, 2);
  }

  // Scale to budget
  const totalTargets = Object.values(targets).reduce((a, b) => a + b, 0);
  if (totalTargets > maxDiscs) {
    const scale = maxDiscs / totalTargets;
    targets.driver = Math.floor(targets.driver * scale);
    targets.fairway = Math.max(skillLevel === "beginner" ? 1 : 0, Math.floor(targets.fairway * scale));
    targets.midrange = Math.max(1, Math.floor(targets.midrange * scale));
    targets.putter = Math.max(1, Math.floor(targets.putter * scale));
  }

  const result: GeneratedDisc[] = [];
  const catOrder: CatKey[] = ["driver", "fairway", "midrange", "putter"];

  for (const cat of catOrder) {
    const n = targets[cat];
    if (n === 0) continue;

    const candidates = allDiscs
      .filter((d) => getDiscCategory(d) === cat)
      .map((d) => ({ disc: d, score: scoreDisc(d, answers) }))
      .filter((c) => c.score > -999)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);

    for (let i = 0; i < candidates.length; i++) {
      const { disc } = candidates[i];
      // Primary disc in category gets ×2 rotation if we want ≥2 of this cat
      const isWorkhorse = i === 0 && n >= 2 && (cat === "midrange" || cat === "putter");
      result.push({
        id: disc.id,
        name: disc.name,
        brand: disc.brand,
        type: disc.type,
        flight: disc.flight,
        image: "image" in disc ? (disc.image as string | undefined) : undefined,
        category: cat,
        quantity: isWorkhorse ? 2 : 1,
        reason: generateReason(disc, cat, answers),
        priceNOK: getBestNOK(disc),
      });
    }
  }

  return result;
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

  function handleBuild() {
    if (!skillLevel || !armSpeed || !budget) return;

    const answers: WizardAnswers = {
      skillLevel,
      armSpeed,
      discTypes,
      budget,
      ownedDiscs,
      courseTypes,
    };

    const generated = generateBag(answers);
    const id = randomId();
    const stored: StoredBag = { answers, discs: generated, generatedAt: Date.now() };
    localStorage.setItem(`discdrop_bag_${id}`, JSON.stringify(stored));
    router.push(`/bag?id=${id}`);
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
