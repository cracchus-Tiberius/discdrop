import type { Metadata } from "next";
import { Suspense } from "react";
import { BagPageClient } from "./[id]/BagPageClient";

export const metadata: Metadata = {
  title: "Din DiscDrop bag | DiscDrop",
  description:
    "Se disc-anbefalingene dine og finn beste pris på hver disc i din bag.",
};

export default function BagPage() {
  return (
    <Suspense fallback={null}>
      <BagPageClient />
    </Suspense>
  );
}
