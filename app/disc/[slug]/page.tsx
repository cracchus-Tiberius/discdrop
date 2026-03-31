import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { discs } from "@/data/discs.js";
import { getAllScrapedEntries, scrapedLastUpdated, getScrapedPrice, getDiscImage } from "@/lib/disc-utils";
import {
  DiscHeroSection,
} from "./DiscDetailClient";

// ── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 relative flex w-full items-center bg-[#1E3D2F] px-8 py-4 shadow-sm">
      <Link
        href="/"
        className="flex shrink-0 items-center transition-opacity hover:opacity-85"
        style={{ gap: 10 }}
      >
        <Image src="/discdrop-logo-dark.svg" alt="DiscDrop" width={170} height={36} className="h-[28px] w-auto md:h-[36px]" />
      </Link>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-[#9DC08B] md:flex">
        <Link href="/" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Hjem
        </Link>
        <a href="/#hot-drops" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Hot Drops
        </a>
        <Link href="/browse" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Alle disker
        </Link>
        <Link href="/bag/build" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Bygg min bag
        </Link>
      </div>
    </nav>
  );
}

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
  const { storeCount } = getScrapedPrice(disc.id);
  const image = getDiscImage(disc);
  const canonical = `https://discdrop.net/disc/${slug}`;
  return {
    title: `${disc.name} | ${disc.brand} | DiscDrop`,
    description: `Finn beste pris på ${disc.name} fra ${disc.brand} i Norge. Se priser fra ${storeCount > 0 ? storeCount : "norske"} butikker inkludert frakt og MVA.`,
    alternates: { canonical },
    openGraph: {
      title: `${disc.name} | ${disc.brand} | DiscDrop`,
      description: `Finn beste pris på ${disc.name} fra ${disc.brand} i Norge. Se priser fra norske butikker inkludert frakt og MVA.`,
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
    <div className="min-h-screen bg-[#F5F2EB]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <div className="bg-[#F5F2EB] px-8 py-3">
        <Link
          href="/browse"
          className="inline-flex items-center gap-1.5 text-sm text-[#9DC08B] transition-colors hover:text-[#2D6A4F]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Tilbake til søk
        </Link>
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
        />
      </main>
      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[#999]">
          <span>© 2026 DiscDrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#444]">Personvern</Link>
            <Link href="/kontakt" className="transition-colors hover:text-[#444]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#444]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
