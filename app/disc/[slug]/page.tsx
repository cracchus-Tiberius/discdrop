import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discs } from "@/data/discs.js";
import { getAllScrapedEntries, scrapedLastUpdated, getScrapedPrice, getDiscImage } from "@/lib/disc-utils";
import { buildDiscMeta } from "@/lib/disc-meta.mjs";
import discDescriptions from "@/data/disc-descriptions.json";
import { SiteHeader } from "@/components/SiteHeader";
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
    description: `${disc.type === "driver" ? "Driver" : disc.type === "midrange" ? "Midrange" : "Putter"} diskgolfdisk fra ${disc.brand}`,
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
      <footer className="border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
          <span>© 2026 discdrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#FFFDF6]">Personvern</Link>
            <Link href="/kontakt" className="transition-colors hover:text-[#FFFDF6]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
