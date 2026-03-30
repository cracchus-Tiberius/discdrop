"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DiscImage } from "./DiscImage";
import { discs } from "@/data/discs.js";
import { getScrapedPrice } from "@/lib/disc-utils";

type Disc = (typeof discs)[number];

const TYPE_LABEL: Record<string, string> = {
  driver: "Distance Driver",
  midrange: "Midrange",
  putter: "Putter",
};

const TYPE_CHIPS = [
  { id: "driver", label: "Distance Driver" },
  { id: "fairway", label: "Fairway Driver" },
  { id: "midrange", label: "Midrange" },
  { id: "putter", label: "Putter" },
] as const;

const TOP_BRANDS = ["Innova", "Discmania", "Discraft", "Kastaplast", "MVP", "Latitude 64"];

/**
 * Controlled search input with live dropdown and smart pre-search panel.
 *
 * Props:
 *   value / onChange  — controlled; parent owns the query string
 *   placeholder       — input placeholder text
 *   className         — wrapper className
 *   inputId           — id attribute on the <input>
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Søk etter disk, merke...",
  className,
  inputId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [quickType, setQuickType] = useState<string | null>(null);
  const [quickBrand, setQuickBrand] = useState<string | null>(null);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allBrands = useMemo(
    () => [...new Set((discs as Disc[]).map((d) => d.brand))].sort(),
    []
  );

  // Results: combines typed query + chip filters
  const results = useMemo(() => {
    const hasQuery = value.trim().length >= 2;
    const hasChip = quickType !== null || quickBrand !== null;
    if (!hasQuery && !hasChip) return [];

    const q = value.toLowerCase();

    return (discs as Disc[])
      .filter((d) => {
        // Type filter (chip)
        if (quickType) {
          const isDriver = d.type === "driver";
          const isFairway = isDriver && d.flight.speed < 10;
          const isDistance = isDriver && d.flight.speed >= 10;
          if (quickType === "fairway" && !isFairway) return false;
          if (quickType === "driver" && !isDistance) return false;
          if (quickType === "midrange" && d.type !== "midrange") return false;
          if (quickType === "putter" && d.type !== "putter") return false;
        }
        // Brand filter (chip)
        if (quickBrand && d.brand !== quickBrand) return false;
        // Text query
        if (hasQuery) {
          const playerMatch =
            "player" in d && (d as { player?: string }).player?.toLowerCase().includes(q);
          return (
            d.name.toLowerCase().includes(q) ||
            d.brand.toLowerCase().includes(q) ||
            d.type.toLowerCase().includes(q) ||
            !!playerMatch
          );
        }
        return true;
      })
      .slice(0, 8);
  }, [value, quickType, quickBrand]);

  const showPanel = focused && value.trim().length < 2 && quickType === null && quickBrand === null;
  const showResults = focused && results.length > 0;
  const showEmpty = focused && value.trim().length >= 2 && results.length === 0 && quickType === null && quickBrand === null;

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFocused(false);
        setQuickType(null);
        setQuickBrand(null);
        setShowAllBrands(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
        setShowAllBrands(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function handleClear() {
    onChange("");
    setQuickType(null);
    setQuickBrand(null);
    setShowAllBrands(false);
  }

  function handleSelect() {
    onChange("");
    setFocused(false);
    setQuickType(null);
    setQuickBrand(null);
    setShowAllBrands(false);
  }

  const hasActiveFilter = quickType !== null || quickBrand !== null;
  const showDropdown = showPanel || showResults || showEmpty || (focused && hasActiveFilter);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Input box */}
      <div className="flex items-center gap-3 rounded-xl border-2 border-[#2D6A4F]/40 bg-white px-5 py-4 shadow-sm transition-all duration-200 focus-within:border-[#2D6A4F] focus-within:shadow-md">
        <svg
          className="shrink-0 text-[#888]"
          width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        {/* Active chip badges */}
        {hasActiveFilter && (
          <div className="flex shrink-0 items-center gap-1.5">
            {quickType && (
              <span className="flex items-center gap-1 rounded-full bg-[#2D6A4F] pl-2.5 pr-1.5 py-1 text-xs font-medium text-white">
                {TYPE_CHIPS.find((t) => t.id === quickType)?.label ?? quickType}
                <button type="button" onClick={() => setQuickType(null)} className="rounded-full p-0.5 hover:bg-white/20">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {quickBrand && (
              <span className="flex items-center gap-1 rounded-full bg-[#2D6A4F] pl-2.5 pr-1.5 py-1 text-xs font-medium text-white">
                {quickBrand}
                <button type="button" onClick={() => setQuickBrand(null)} className="rounded-full p-0.5 hover:bg-white/20">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </span>
            )}
          </div>
        )}

        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={hasActiveFilter ? "Søk innenfor valgt filter..." : placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-base text-[#1a1a1a] outline-none placeholder:text-[#aaa]"
        />
        {(value || hasActiveFilter) && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Tøm søk"
            className="shrink-0 rounded-full p-1 text-[#999] transition-colors hover:bg-[#f0f0ee] hover:text-[#1a1a1a]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[50vh] overflow-y-auto rounded-xl border border-[#e5e5e5] bg-white shadow-lg">

          {/* Pre-search chip panel */}
          {showPanel && (
            <div className="px-4 py-4">
              {/* Category */}
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#999]">
                Kategori
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {TYPE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setQuickType(chip.id)}
                    className="rounded-full border border-[#e0e0e0] bg-[#f7f6f2] px-3.5 py-1.5 text-sm text-[#444] transition-colors hover:border-[#2D6A4F]/50 hover:bg-[#edf5f0] hover:text-[#2D6A4F]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Brand */}
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#999]">
                Merke
              </div>
              <div className="flex flex-wrap gap-2">
                {(showAllBrands ? allBrands : TOP_BRANDS).map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setQuickBrand(brand)}
                    className="rounded-full border border-[#e0e0e0] bg-[#f7f6f2] px-3.5 py-1.5 text-sm text-[#444] transition-colors hover:border-[#2D6A4F]/50 hover:bg-[#edf5f0] hover:text-[#2D6A4F]"
                  >
                    {brand}
                  </button>
                ))}
                {!showAllBrands && (
                  <button
                    type="button"
                    onClick={() => setShowAllBrands(true)}
                    className="rounded-full border border-dashed border-[#ccc] px-3.5 py-1.5 text-sm text-[#888] transition-colors hover:border-[#2D6A4F]/50 hover:text-[#2D6A4F]"
                  >
                    Alle merker →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active chip filter results — show even when panel is hidden */}
          {(showResults || (focused && hasActiveFilter && results.length > 0)) && (
            <>
              {hasActiveFilter && (
                <div className="border-t border-[#f0f0f0] px-4 py-2 text-[11px] text-[#999]">
                  {results.length} disk{results.length !== 1 ? "er" : ""} funnet
                  {quickType && ` · ${TYPE_CHIPS.find((t) => t.id === quickType)?.label}`}
                  {quickBrand && ` · ${quickBrand}`}
                </div>
              )}
              {results.map((d) => {
                const price = getScrapedPrice(d.id).price;
                return (
                  <Link
                    key={d.id}
                    href={`/disc/${d.id}`}
                    onClick={handleSelect}
                    className="flex cursor-pointer items-center justify-between border-b border-[#f0f0f0] px-5 py-3 transition-colors last:border-0 hover:bg-[#f9f9f7]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex shrink-0 items-center justify-center rounded-lg bg-[#F5F2EB]"
                        style={{ width: 36, height: 36 }}
                      >
                        <DiscImage
                          src={"image" in d ? (d.image as string) : ""}
                          name={d.name}
                          brand={d.brand}
                          type={d.type}
                          containerStyle={{ height: 36 }}
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-[#1a1a1a]">{d.name}</span>
                        <span className="block truncate text-xs text-[#888]">{d.brand}</span>
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <span className="hidden rounded-full bg-[#f0f0ee] px-2.5 py-1 text-xs text-[#888] sm:inline">
                        {TYPE_LABEL[d.type] ?? d.type}
                      </span>
                      {price != null && (
                        <span className="text-sm font-medium text-[#2D6A4F]">fra kr {price}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-5 py-4 text-sm text-[#888]">
              Ingen resultater for &ldquo;{value}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
