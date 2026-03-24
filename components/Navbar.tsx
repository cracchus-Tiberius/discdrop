import Link from "next/link";

function DiscIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-accent transition-opacity hover:opacity-90"
        >
          <DiscIcon className="h-8 w-8 shrink-0" />
          <span className="font-heading text-xl font-semibold tracking-tight">
            <span className="text-accent">Disc</span>
            <span className="text-accent">Drop</span>
          </span>
        </Link>
        <div className="text-sm text-muted">Norway</div>
      </nav>
    </header>
  );
}
