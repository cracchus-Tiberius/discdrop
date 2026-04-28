// Pure meta-tag string builder for /disc/[slug] pages.
// Imported by app/disc/[slug]/page.tsx (generateMetadata) and
// scripts/check-meta-lengths.mjs (build-time audit) — single source of truth.

export const TITLE_HARD_MAX = 65;
export const DESCRIPTION_HARD_MAX = 160;

function discTypeNorwegian(disc) {
  if (disc.type === "putter") return "putter";
  if (disc.type === "midrange") return "midrange";
  const speed = disc.flight?.speed ?? 0;
  return speed >= 10 ? "distance driver" : "fairway driver";
}

/**
 * @param {{ id: string; name: string; brand: string; type: string; flight?: { speed?: number } }} disc
 * @param {{ price: number | null; inStockCount: number }} priceInfo
 * @returns {{ title: string; description: string; ogTitle: string; hasPrice: boolean }}
 */
export function buildDiscMeta(disc, { price, inStockCount }) {
  const fullName = `${disc.brand} ${disc.name}`;
  const typeNo = discTypeNorwegian(disc);
  const hasPrice = price != null && inStockCount > 0;
  const roundedPrice = hasPrice ? Math.round(price) : null;
  const butikkLabel = inStockCount === 1 ? "1 butikk" : `${inStockCount} butikker`;

  let title;
  let ogTitle;
  if (hasPrice) {
    const fullTitle = `${fullName} fra kr ${roundedPrice} — Sammenlign ${butikkLabel} | DiscDrop`;
    title =
      fullTitle.length <= TITLE_HARD_MAX
        ? fullTitle
        : `${disc.name} fra kr ${roundedPrice} — Sammenlign ${butikkLabel} | DiscDrop`;
    ogTitle = `${fullName} — fra kr ${roundedPrice} i Norge`;
  } else {
    const fullTitle = `${fullName} — Sammenlign priser i Norge | DiscDrop`;
    title = fullTitle.length <= TITLE_HARD_MAX ? fullTitle : `${disc.name} — Sammenlign priser i Norge | DiscDrop`;
    ogTitle = `${fullName} — Sammenlign priser i Norge`;
  }

  const descFull = hasPrice
    ? `Finn beste pris på ${fullName} (${disc.brand} ${typeNo}). Sammenlign ${butikkLabel}, se fraktkostnad og total landing til Norge. Fra kr ${roundedPrice}.`
    : `Finn beste pris på ${fullName} (${disc.brand} ${typeNo}). Sammenlign norske og nordiske butikker, se fraktkostnad og total landing til Norge.`;
  const descShort = hasPrice
    ? `Finn beste pris på ${fullName} (${typeNo}). Sammenlign ${butikkLabel}, se fraktkostnad og total landing til Norge. Fra kr ${roundedPrice}.`
    : `Finn beste pris på ${fullName} (${typeNo}). Sammenlign norske og nordiske butikker, se fraktkostnad og total landing til Norge.`;
  const description = descFull.length <= DESCRIPTION_HARD_MAX ? descFull : descShort;

  return { title, description, ogTitle, hasPrice };
}
