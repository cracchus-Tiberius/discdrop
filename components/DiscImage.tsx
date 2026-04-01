"use client";

import { useState } from "react";

function brandInitials(brand: string): string {
  const words = brand.split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return brand.slice(0, 2).toUpperCase();
}

const BRAND_COLORS: Record<string, string> = {
  Innova: "#2D6A4F",
  Discraft: "#1a3a5c",
  "Dynamic Discs": "#4a1f6e",
  "Latitude 64": "#8B0000",
  Kastaplast: "#FF6B00",
  MVP: "#1a1a2e",
  Axiom: "#1a1a2e",
  Discmania: "#c41e3a",
  Prodigy: "#2c5f2e",
  Westside: "#4a3728",
};

// Side-profile disc shapes: [bodyRx, bodyRy, plateRx, plateRy]
// bodyRx/bodyRy control the outer disc ellipse
// plateRx/plateRy control the inner flight-plate highlight
const DISC_SHAPES: Record<string, [number, number, number, number]> = {
  driver: [90, 20, 42, 9],    // distance driver — wide and flat
  distance: [90, 20, 42, 9],  // alias
  fairway: [84, 28, 40, 13],  // fairway driver — medium profile
  midrange: [76, 37, 36, 17], // midrange — rounder
  putter: [65, 47, 32, 22],   // putter — nearly round / dome
};

function DiscPlaceholder({
  brand,
  type,
}: {
  brand: string;
  type?: string;
}) {
  const color = BRAND_COLORS[brand] ?? "#2D6A4F";
  const abbr = brandInitials(brand);
  const [rx, ry, plateRx, plateRy] =
    DISC_SHAPES[type ?? "driver"] ?? DISC_SHAPES.driver;

  // ViewBox is symmetric around (0,0) with a small padding
  const pad = 8;
  const vbH = (ry + pad) * 2;
  const fontSize = Math.max(10, Math.min(20, ry * 0.55));

  return (
    <svg
      viewBox={`-100 ${-(ry + pad)} 200 ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: "100%", maxWidth: "100%", display: "block" }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${brand} ${type ?? "disc"}`}
    >
      {/* Disc body */}
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={color} />
      {/* Subtle rim bevel */}
      <ellipse
        cx="0"
        cy="0"
        rx={rx - 5}
        ry={ry - 3}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="4"
      />
      {/* Flight plate highlight */}
      <ellipse
        cx="0"
        cy={-(ry * 0.28)}
        rx={plateRx}
        ry={plateRy}
        fill="rgba(255,255,255,0.18)"
      />
      {/* Brand initials */}
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="1.5"
        opacity="0.9"
      >
        {abbr}
      </text>
    </svg>
  );
}

export function DiscImage({
  src,
  name,
  brand,
  type,
  containerStyle,
}: {
  src?: string;
  name: string;
  brand: string;
  type?: string;
  containerStyle?: React.CSSProperties;
}) {
  // Start in failed state if src is absent — avoids a wasted network request
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    return (
      <div
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...containerStyle }}
      >
        <DiscPlaceholder brand={brand} type={type} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}
