"use client";

// components/PriceThresholdInput.tsx — the "Varsle meg under X kr" price
// field, shared by every "Bli varslet" surface (components/PriceAlertInline.tsx
// for the Prisfall page's compact strip, app/disc/[slug]/DiscDetailClient.tsx's
// dedicated signup box) so the fix lives in exactly one place. Previously
// each surface hand-rolled its own <input type="number">, which meant a
// native spinner, no shared validation, and PriceAlertInline pre-filling a
// "suggested" number instead of leaving the field genuinely empty.
//
// Empty = notify at any price (matches the helper text next to this field
// on both surfaces) — never a live default value.

import { useId } from "react";
import { MIN_VALID_PRICE_NOK } from "@/lib/disc-utils";

export const PRICE_ALERT_MIN = MIN_VALID_PRICE_NOK;

/** null = valid (including empty — "any price"). Non-null = the inline error message to show. */
export function validatePriceThreshold(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "Skriv inn et helt tall.";
  if (Number(trimmed) < PRICE_ALERT_MIN) return `Må være minst ${PRICE_ALERT_MIN} kr.`;
  return null;
}

type Variant = "light" | "dark";

const VARIANT_STYLES: Record<Variant, { wrap: string; input: string; unit: string; label: string }> = {
  // Solid cream pill on a dark card — components/PriceAlertInline.tsx's own
  // existing treatment (matches its disc <select> next to it).
  light: {
    wrap: "bg-[#FFFDF6]",
    input: "text-[#101C14] placeholder:text-[#101C1477]",
    unit: "text-[#101C1499]",
    label: "text-[#FFFDF6]/70",
  },
  // Translucent white on a dark card — DiscDetailClient's PriceAlertSignup
  // treatment, matching its email input next to it.
  dark: {
    wrap: "border border-white/10 bg-white/10 focus-within:border-[#B8E04A]/60",
    input: "text-[#FFFDF6] placeholder:text-[#FFFDF6]/40",
    unit: "text-[#FFFDF6]/60",
    label: "text-[#FFFDF6]/70",
  },
};

export function PriceThresholdInput({
  value,
  onChange,
  variant = "dark",
  showLabel = true,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  variant?: Variant;
  /** Set false when the field's purpose is already obvious from surrounding text (e.g. "er under ___ kr" reads as its own label) — the accessible label is still there either way, just visually hidden. */
  showLabel?: boolean;
  id?: string;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const error = validatePriceThreshold(value);
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={className}>
      <label htmlFor={inputId} className={`mb-1 block text-xs font-semibold ${styles.label} ${showLabel ? "" : "sr-only"}`}>
        Varsle meg under (valgfritt)
      </label>
      <div
        className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-[11px] ${styles.wrap} ${
          error ? "outline outline-2 outline-[#E8704A]" : ""
        }`}
      >
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          // Digits only — no need for a full numeric parse; strips
          // anything a mobile numeric keyboard or a paste could sneak in
          // (including "-", "e", "." that a native <input type="number">
          // would otherwise silently accept).
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="f.eks. 180"
          aria-invalid={error != null}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full min-w-0 flex-1 bg-transparent text-[15px] font-extrabold outline-none ${styles.input}`}
        />
        <span className={`shrink-0 text-sm font-semibold ${styles.unit}`}>kr</span>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-[#E8704A]">
          {error}
        </p>
      )}
    </div>
  );
}
