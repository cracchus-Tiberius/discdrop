import type { MetadataRoute } from "next";
import { discs } from "@/data/discs.js";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://discdrop.net";

  const discEntries: MetadataRoute.Sitemap = discs.map((d) => ({
    url: `${base}/disc/${d.id}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    {
      url: base,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${base}/bag/build`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...discEntries,
  ];
}
