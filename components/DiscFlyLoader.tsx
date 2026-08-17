// components/DiscFlyLoader.tsx — loading indicator for the AI bag builder
// (app/bag/build/page.tsx). A disc glides horizontally with a gentle
// up/down bob, trailed by a few wind-streak lines — not a spinning disc,
// which reads as "loading a generic spinner" rather than "throwing a disc".
// Keyframes (discGlideFly / windStreak) live in app/globals.css.

const STREAKS = [
  { top: "38%", delay: "0s", width: 22 },
  { top: "52%", delay: "0.35s", width: 16 },
  { top: "62%", delay: "0.7s", width: 26 },
];

export function DiscFlyLoader() {
  return (
    <div className="relative h-24 w-full max-w-[280px] overflow-hidden" aria-hidden>
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="absolute left-1/2 h-[2px] rounded-full bg-[#101C14]/20"
          style={{
            top: s.top,
            width: s.width,
            animation: "windStreak 1.1s linear infinite",
            animationDelay: s.delay,
          }}
        />
      ))}
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        className="absolute left-1/2 top-1/2 -ml-8 -mt-8"
        style={{ animation: "discGlideFly 1.6s ease-in-out infinite" }}
      >
        <ellipse cx="12" cy="14" rx="10" ry="4.5" fill="#101C14" />
        <ellipse cx="12" cy="12" rx="5" ry="2.5" fill="#B8E04A" />
        <ellipse cx="12" cy="10.5" rx="2" ry="1.2" fill="#FFFDF6" opacity="0.7" />
      </svg>
    </div>
  );
}
