"use client";

import { useState } from "react";

function initials(brand: string): string {
  const words = brand.split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return brand.slice(0, 2).toUpperCase();
}

export function DiscImage({
  src,
  name,
  brand,
  containerStyle,
}: {
  src: string;
  name: string;
  brand: string;
  containerStyle?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={containerStyle}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2D6A4F]">
          <span className="text-sm font-bold tracking-wider text-[#F5F2EB]">
            {initials(brand)}
          </span>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-[#2D6A4F] leading-tight">{name}</p>
          <p className="text-[10px] text-[#888] leading-tight">{brand}</p>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
    />
  );
}
