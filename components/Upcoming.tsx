function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function typeLabel(type: string) {
  return type === "midrange"
    ? "Mid-range"
    : type.charAt(0).toUpperCase() + type.slice(1);
}

export type UpcomingRelease = {
  id: string;
  name: string;
  brand: string;
  type: string;
  expectedDate: string;
  tags: string[];
  description: string;
  player?: string;
};

export default function Upcoming({ items }: { items: UpcomingRelease[] }) {
  return (
    <section className="border-t border-white/5 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Upcoming
        </h2>
        <p className="mt-1 text-sm text-muted">
          Drops we&apos;re tracking before they hit the shelves.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-white/10 bg-surface/80 p-5 shadow-lg shadow-black/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {item.name}
                  </h3>
                  <p className="text-sm text-muted">{item.brand}</p>
                </div>
                <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-muted ring-1 ring-white/10">
                  {typeLabel(item.type)}
                </span>
              </div>
              {"player" in item && item.player ? (
                <p className="mt-2 text-sm text-foreground/90">{item.player}</p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-muted/95">
                {item.description}
              </p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-accent">
                Expected {formatDate(item.expectedDate)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
