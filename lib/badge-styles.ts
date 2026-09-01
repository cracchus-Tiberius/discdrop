export type BadgeStyle = { bg: string; text: string; label: string };

// Single source of truth for disc tag badges — keeps every page's "HOT"/"NY DROP"/etc.
// sticker the same color instead of each page inventing its own palette. Colors are
// drawn from the 1b Pop token set (globals.css): lime accent, ink, alert, muted-bg.
export const BADGE_STYLES: Record<string, BadgeStyle> = {
  hot: { bg: "#E8704A", text: "#FFFFFF", label: "HOT" },
  new: { bg: "#B8E04A", text: "#101C14", label: "NY DROP" },
  "new-drop": { bg: "#B8E04A", text: "#101C14", label: "NY DROP" },
  limited: { bg: "#E8704A", text: "#FFFFFF", label: "BEGRENSET" },
  "tour-series": { bg: "#101C14", text: "#B8E04A", label: "TOUR SERIES" },
  "first-run": { bg: "#101C14", text: "#B8E04A", label: "FIRST RUN" },
  "sold-out": { bg: "#88888D", text: "#FFFFFF", label: "UTSOLGT" },
  upcoming: { bg: "#F1EFE6", text: "#101C14", label: "KOMMENDE" },
  // "Nytt i butikk" feature (data/new-in-stores/, lib/new-in-stores.ts).
  // new-disc reuses the lime "new-drop" look (it IS a new-drop, just a
  // stronger claim — first time this mold has ever been seen); new-edition
  // gets the brand's primary green (CLAUDE.md's #2D6A4F) instead of lime, so
  // it doesn't visually compete with an actual new-disc card sitting next
  // to it in the same grid. new-at-store has no badge — it never gets an
  // individual card, only a compact per-store grouped list.
  "new-disc": { bg: "#B8E04A", text: "#101C14", label: "NY DISK" },
  "new-edition": { bg: "#2D6A4F", text: "#FFFFFF", label: "NY UTGAVE" },
};
