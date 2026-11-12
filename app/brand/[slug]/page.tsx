import { discs } from "@/data/discs.js";
import { SLUG_TO_BRAND as SLUGS, BRAND_SLUGS, discsForSlug } from "@/lib/brands";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BrandPageClient from "./BrandPageClient";

// Brand slugs live in lib/brands.ts — one map, asserted against the catalogue
// by lib/brands.test.ts. This file used to carry its own copy, which is how
// /brand/eggshell-discs/ outlived the brand's rename and how seven brands
// never got a page at all. Re-exported because app/sitemap.ts imports from
// here.
export { SLUG_TO_BRAND, BRAND_TO_SLUG } from "@/lib/brands";

export function generateStaticParams() {
  return BRAND_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = SLUGS[slug];
  if (!brand) return {};
  const count = discs.filter((d) => d.brand === brand).length;
  return {
    title: `${brand} disker – priser i Norge | DiscDrop`,
    description: `Sammenlign priser på ${count} ${brand}-disker fra norske nettbutikker. Finn beste pris på puttere, midranges og drivere fra ${brand}.`,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = SLUGS[slug];
  if (!brand) notFound();

  const brandDiscs = discs.filter((d) => d.brand === brand);
  if (brandDiscs.length === 0) notFound();

  return <BrandPageClient brand={brand} slug={slug} discs={brandDiscs} />;
}
