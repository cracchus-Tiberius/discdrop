"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DiscImage } from "./DiscImage";
import { discs } from "@/data/discs.js";

type Disc = (typeof discs)[number];

function bestPriceNOK(disc: Disc): number | null {
  const inStock = disc.stores.filter((s) => s.inStock).map((s) => s.price);
  const pool = inStock.length ? inStock : disc.stores.map((s) => s.price);
  return pool.length ? Math.min(...pool) : null;
}

const TYPE_LABEL: Record<string, string> = {
  driver: "Distance Driver",
  midrange: "Midrange",
  putter: "Putter",
};

/**
 * Controlled search input with live dropdown.
 *
 * Props:
 *   value / onChange  — controlled; parent owns the query string
 *   placeholder       — input placeholder text
 *   className         — wrapper className
 *   inputId           — id attribute on the <input> (e.g. for IntersectionObserver)
 *
 * Behaviour:
 *   - Dropdown opens when value.trim().length >= 2
 *   - Escape key closes dropdown
 *   - Click / tap outside closes dropdown
 *   - Selecting a result calls onChange("") then navigates via <Link>
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search discs, brands, players...",
  className,
  inputId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (value.trim().length < 2) return [];
    const q = value.toLowerCase();
    return (discs as Disc[])
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          ("player" in d && (d as { player?: string }).player?.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [value]);

  // Open dropdown whenever there's a valid query
  useEffect(() => {
    setDropdownOpen(value.trim().length >= 2);
  }, [value]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function handleChange(v: string) {
    onChange(v);
  }

  function handleClear() {
    onChange("");
    setDropdownOpen(false);
  }

  function handleSelect() {
    onChange("");
    setDropdownOpen(false);
  }

  const showResults = dropdownOpen && results.length > 0;
  const showEmpty = dropdownOpen && value.trim().length >= 2 && results.length === 0;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Input box */}
      <div className="flex items-center gap-3 rounded-xl border-2 border-[#2D6A4F]/40 bg-white px-5 py-4 shadow-sm transition-all duration-200 focus-within:border-[#2D6A4F] focus-within:shadow-md">
        <svg
          className="shrink-0 text-[#888]"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          id={inputId}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length >= 2) setDropdownOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent text-base text-[#1a1a1a] outline-none placeholder:text-[#aaa]"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Tøm søk"
            className="shrink-0 rounded-full p-1 text-[#999] transition-colors hover:bg-[#f0f0ee] hover:text-[#1a1a1a]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {(showResults || showEmpty) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-lg">
          {showEmpty && (
            <div className="px-5 py-4 text-sm text-[#888]">
              Ingen resultater for &ldquo;{value}&rdquo;
            </div>
          )}
          {showResults &&
            results.map((d) => {
              const price = bestPriceNOK(d);
              return (
                <Link
                  key={d.id}
                  href={`/disc/${d.id}`}
                  onClick={handleSelect}
                  className="flex cursor-pointer items-center justify-between border-b border-[#f0f0f0] px-5 py-3 transition-colors last:border-0 hover:bg-[#f9f9f7]"
                >
                  {/* Left: image + name + brand */}
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
                      <span className="block truncate font-medium text-[#1a1a1a]">
                        {d.name}
                      </span>
                      <span className="block truncate text-xs text-[#888]">
                        {d.brand}
                      </span>
                    </div>
                  </div>

                  {/* Right: type badge + price */}
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="hidden rounded-full bg-[#f0f0ee] px-2.5 py-1 text-xs text-[#888] sm:inline">
                      {TYPE_LABEL[d.type] ?? d.type}
                    </span>
                    {price != null && (
                      <span className="text-sm font-medium text-[#2D6A4F]">
                        {price} kr
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
