// lib/seo.ts — shared Open Graph fallback for every page without its own
// real image (disc detail pages are the one exception — they use the
// disc's actual photo). Next.js's Metadata API does NOT deep-merge a page's
// `openGraph` object with the root layout's: a page that defines its own
// openGraph (even just for a page-specific title/description) silently
// drops the layout's images/type along with it. Confirmed in production:
// every page below except the homepage was missing og:image entirely
// (not falling back to anything — genuinely absent), and the homepage
// itself pointed at a leftover /discdrop-logo-clean.svg. Import this into
// every page-level `openGraph` block that doesn't have a real image of its
// own, rather than repeating the literal.
export const BRAND_OG_IMAGE = {
  url: "https://discdrop.net/og.png",
  width: 1200,
  height: 630,
  alt: "DiscDrop — Sammenlign diskgolfpriser i Norge",
};

export const OG_TYPE_WEBSITE = "website" as const;
