import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discs } from "@/data/discs.js";
import { getAllScrapedEntries, scrapedLastUpdated, getScrapedPrice, getDiscImage } from "@/lib/disc-utils";
import { buildDiscMeta } from "@/lib/disc-meta.mjs";
import discDescriptions from "@/data/disc-descriptions.json";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  DiscHeroSection,
} from "./DiscDetailClient";

// ── Page ─────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return discs.map((d) => ({ slug: d.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const disc = discs.find((d) => d.id === slug);
  if (!disc) return {};

  const { price, inStockCount } = getScrapedPrice(disc.id);
  const image = getDiscImage(disc);
  const canonical = `https://discdrop.net/disc/${slug}`;

  const { title, description, ogTitle } = buildDiscMeta(disc, { price, inStockCount });

  if (process.env.NODE_ENV !== "production") {
    if (title.length > 65) console.warn(`[meta] /disc/${slug} title ${title.length} chars (>65): ${title}`);
    if (description.length > 160) console.warn(`[meta] /disc/${slug} description ${description.length} chars (>160): ${description}`);
  }

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      images: image !== "/disc-placeholder.svg" ? [{ url: image }] : [],
    },
  };
}

export default async function DiscDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const disc = discs.find((d) => d.id === slug);

  if (!disc) notFound();

  const { price, storeCount, inStockCount } = getScrapedPrice(disc.id);
  const discImage = getDiscImage(disc);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: disc.name,
    brand: { "@type": "Brand", name: disc.brand },
    description: `${disc.type === "distance" ? "Distance driver" : disc.type === "fairway" ? "Fairway driver" : disc.type === "midrange" ? "Midrange" : "Putter"} diskgolfdisk fra ${disc.brand}`,
    ...(discImage !== "/disc-placeholder.svg" ? { image: discImage } : {}),
    ...(storeCount > 0
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "NOK",
            ...(price != null ? { lowPrice: price } : {}),
            offerCount: storeCount,
            ...(inStockCount > 0
              ? { availability: "https://schema.org/InStock" }
              : { availability: "https://schema.org/OutOfStock" }),
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-4 md:px-10">
        <span className="text-sm font-semibold text-[#101C1488]">
          <Link href="/" className="hover:text-[#101C14]">Hjem</Link>
          {" / "}
          <Link href="/browse" className="hover:text-[#101C14]">Alle disker</Link>
          {" / "}
          <span className="text-[#101C14]">{disc.name}</span>
        </span>
      </div>
      <main>
        <DiscHeroSection
          disc={{
            name: disc.name,
            brand: disc.brand,
            type: disc.type,
            player: "player" in disc ? (disc.player as string | undefined) : undefined,
            tags: disc.tags as string[],
            flight: disc.flight,
            image: getDiscImage(disc),
          }}
          discId={disc.id}
          allEntries={getAllScrapedEntries(disc.id)}
          lastUpdated={scrapedLastUpdated}
          description={(discDescriptions as Record<string, string>)[disc.id] ?? null}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
