import type { MetadataRoute } from "next";
import { discs } from "@/data/discs.js";
import { SLUG_TO_BRAND } from "@/app/brand/[slug]/page";
import { getWeekIndex } from "@/lib/new-in-stores";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // IMPORTANT: All URLs must end with "/" because next.config.ts sets
  // trailingSlash: true. Mismatched URLs cause 308 redirects, which Google
  // flags as "Page with redirect — not indexed" in Search Console.
  const base = "https://discdrop.net";

  const discEntries: MetadataRoute.Sitemap = discs.map((d) => ({
    url: `${base}/disc/${d.id}/`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // 21 real, statically-generated pages that were entirely missing from
  // the sitemap — confirmed live via curl against /sitemap.xml (16.08.2026,
  // investigating the GSC indexed-pages drop). They're reachable via
  // on-site navigation, so Google could still find them by crawling links,
  // but an explicit sitemap entry is the more reliable discovery signal.
  const brandEntries: MetadataRoute.Sitemap = Object.keys(SLUG_TO_BRAND).map((slug) => ({
    url: `${base}/brand/${slug}/`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // A frozen week's file is immutable once written (see CLAUDE.md's
  // "Hard-earned rules") — "never" is the accurate changeFrequency, not a
  // guess. The live current week still updates daily.
  const nyttWeekEntries: MetadataRoute.Sitemap = getWeekIndex().map((w) => ({
    url: `${base}/nytt/${w.slug}/`,
    changeFrequency: w.frozen ? "never" : "daily",
    priority: 0.6,
  }));

  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${base}/browse/`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/prisfall/`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/nytt/`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/bag/build/`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/butikker/`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/kontakt/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/personvern/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...brandEntries,
    ...nyttWeekEntries,
    ...discEntries,
  ];
}
