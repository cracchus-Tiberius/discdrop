"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/disc-utils";

/** Renders "for 2 timer siden" etc. — client-only, computed after mount.
 * The page is statically generated, so `formatRelativeTime` computed during
 * SSR reflects the build timestamp, not "now" for whoever is actually
 * loading the page — computing it inline caused a hydration mismatch
 * (server text != client text) on every page load. Rendering nothing until
 * mounted keeps the very first client render identical to the server's,
 * then fills in the real value right after. */
export function RelativeTime({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(formatRelativeTime(iso));
  }, [iso]);

  if (!text) return null;
  return (
    <>
      {prefix}
      {text}
    </>
  );
}
