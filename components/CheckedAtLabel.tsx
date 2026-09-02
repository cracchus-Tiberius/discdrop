"use client";

import { useEffect, useState } from "react";
import { formatCheckedAtLabel } from "@/lib/disc-utils";

/**
 * "i dag kl. 13:44" / "i går kl. 13:44" / "31. august kl. 13:44" — client-
 * only, computed after mount, same reasoning as components/RelativeTime.tsx:
 * this is a static export, so a label baked in at build time reflects the
 * scrape's own "now", not whoever is actually loading the page later — and
 * unlike a plain duration ("for 3 timer siden"), "i dag" specifically goes
 * FALSE (not just stale-looking) the moment the calendar day rolls over
 * without a fresh deploy. Renders nothing until mounted so the first client
 * render matches the server's (no hydration mismatch), then fills in.
 */
export function CheckedAtLabel({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(formatCheckedAtLabel(iso));
  }, [iso]);

  if (!text) return null;
  return <>{text}</>;
}
