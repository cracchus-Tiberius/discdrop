import { discs } from "@/data/discs.js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BrandPageClient from "./BrandPageClient";

export const SLUG_TO_BRAND: Record<string, string> = {
  "kastaplast": "Kastaplast",
  "innova": "Innova",
  "discraft": "Discraft",
  "discmania": "Discmania",
  "latitude-64": "Latitude 64",
  "dynamic-discs": "Dynamic Discs",
  "westside-discs": "Westside Discs",
  "mvp": "MVP",
  "axiom": "Axiom",
  "streamline": "Streamline",
  "prodigy": "Prodigy",
  "viking-discs": "Viking Discs",
  "rpm": "RPM Discs",
  "thought-space-athletics": "Thought Space Athletics",
  "alfa": "Alfa",
  "eggshell-discs": "EggShell Discs",
  "clash-discs": "Clash Discs",
  "prodiscus": "Prodiscus",
  "lone-star-discs": "Lone Star Discs",
  "gateway": "Gateway",
  "millennium": "Millennium",
};

export const BRAND_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_BRAND).map(([slug, brand]) => [brand, slug])
);

export function generateStaticParams() {
  return Object.keys(SLUG_TO_BRAND).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = SLUG_TO_BRAND[slug];
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
  const brand = SLUG_TO_BRAND[slug];
  if (!brand) notFound();

  const brandDiscs = discs.filter((d) => d.brand === brand);
  if (brandDiscs.length === 0) notFound();

  return <BrandPageClient brand={brand} slug={slug} discs={brandDiscs} />;
}
