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
};
