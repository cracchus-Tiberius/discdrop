import { SHIPPING_RATES } from "@/data/shipping-rates.js";

type Pickup = {
  available: boolean;
  location?: string;
  byArrangement?: boolean;
  note?: string;
};

/**
 * "Gratis henting · Siggerud" on a store that offers collection.
 *
 * Wording tracks what was actually verified. A store where collection has to
 * be arranged first — Frisbee Sør answers by email, GolfDiscer opens the
 * warehouse by appointment — says "Henting etter avtale" instead, because
 * promising "gratis henting" for something you cannot just turn up and do
 * would be the wrong kind of accurate.
 *
 * Purely informational: pickup never enters price sorting, since the ranking
 * compares landed cost for a disc that gets posted.
 */
export function PickupBadge({ storeKey }: { storeKey: string }) {
  const pickup = (SHIPPING_RATES as Record<string, { pickup?: Pickup }>)[storeKey]?.pickup;
  if (!pickup?.available) return null;

  const label = pickup.byArrangement ? "Henting etter avtale" : "Gratis henting";
  const text = pickup.location ? `${label} · ${pickup.location}` : label;

  return (
    <span className="dd-chip-pickup" title={pickup.note ? `${text} (${pickup.note})` : text}>
      {text}
    </span>
  );
}
