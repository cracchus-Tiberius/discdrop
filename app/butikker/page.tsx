import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import scrapedPrices from "@/data/scraped-prices.json";
import { STORE_PROFILES } from "@/data/store-profiles.js";

export const metadata: Metadata = {
  title: "Butikkene våre | DiscDrop",
  description:
    "Se hvilke nettbutikker DiscDrop henter priser fra, og bli kjent med hver enkelt butikk i deres egne ord.",
};

type StoreMeta = {
  name: string;
  url: string;
  freeShippingOver?: number;
  shipping: number;
  country?: string;
  voec?: boolean;
};

const stores = scrapedPrices.stores as Record<string, StoreMeta>;

function countDiscsForStore(storeKey: string): number {
  let count = 0;
  for (const entries of Object.values(scrapedPrices.prices)) {
    if ((entries as { store: string }[]).some((e) => e.store === storeKey)) count++;
  }
  return count;
}

export default function ButikkerPage() {
  const storeKeys = Object.keys(stores).sort(
    (a, b) => countDiscsForStore(b) - countDiscsForStore(a)
  );

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-[#101C14]">
          Butikkene våre
        </h1>
        <p className="mb-12 max-w-2xl text-[#101C1499]">
          DiscDrop sammenligner priser fra {storeKeys.length} nettbutikker i Norge og
          Sverige, oppdatert daglig. Her er hver enkelt butikk i deres egne ord —
          hentet fra deres egne nettsider.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {storeKeys.map((key) => {
            const store = stores[key];
            const profile = STORE_PROFILES[key as keyof typeof STORE_PROFILES];
            const discCount = countDiscsForStore(key);
            const isSweden = store.country === "SE";

            return (
              <div
                key={key}
                className="flex flex-col rounded-2xl border-2 border-[#101C14] bg-white p-6 shadow-[4px_4px_0_#101C14]"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-extrabold text-[#101C14]">{store.name}</h2>
                  <span className="shrink-0 rounded-full bg-[#F1EFE6] px-2.5 py-1 text-[11px] font-semibold text-[#101C1499]">
                    {isSweden ? "🇸🇪 Sverige" : "🇳🇴 Norge"}
                  </span>
                </div>

                {profile && (
                  <p className="mb-3 -rotate-1 self-start rounded-lg bg-[#B8E04A] px-2.5 py-1 text-xs font-extrabold text-[#101C14] shadow-[2px_2px_0_#101C14]">
                    {profile.tagline}
                  </p>
                )}

                {profile && (
                  <p className="mb-4 text-sm leading-relaxed text-[#101C14CC]">
                    {profile.blurb}
                  </p>
                )}

                <div className="mt-auto space-y-1 border-t border-[#101C1414] pt-4 text-[12px] text-[#101C1499]">
                  <p>{discCount} disker hos oss</p>
                  <p>
                    {store.freeShippingOver
                      ? `Fri frakt over kr ${store.freeShippingOver} · ellers kr ${store.shipping}`
                      : `Frakt fra kr ${store.shipping}`}
                    {isSweden && store.voec && " · MVA inkludert (VOEC)"}
                  </p>
                </div>

                <a
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-[#101C14] bg-[#101C14] px-4 py-2 text-sm font-semibold text-[#FFFDF6] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  Besøk butikken ↗
                </a>
              </div>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
