@AGENTS.md

# DiscDrop — Project Status (2026-03-22)

## What Was Built

### Home Page (`app/page.tsx` → `app/disc-drop-home.tsx`)
Full landing page with:
- **Navbar** — logo, nav links, search button
- **Hero** — live search with dropdown suggestions
- **HotDrops** — horizontal scrolling carousel of featured discs
- **Upcoming** — grid of pre-release discs
- **BrowseGrid** — filterable disc grid (All / Drivers / Midrange / Putters / On Sale)

### Disc Detail Page (`app/disc/[slug]/`)
- Server component for static params + 404
- Client: `DiscDetailClient.tsx` with:
  - **PriceTable** — desktop table + mobile card layout, sorted by price, highlights best deal, VOEC/handling fee badges
  - **LandedCostCalculator** — interactive form (price, shipping, currency, VOEC toggle) with real-time NOK total
  - **PriceHistoryChart** — Chart.js bar chart, 12-month history, color-coded min/max
  - **FlightPathChart** — SVG flight sim for slow/medium/fast arm speeds
  - **PriceAlertSignup** — email + target price form

### Bag Builder (`app/bag/build/page.tsx`)
7-step wizard client component:
1. Throwing style (backhand/forehand/both)
2. Skill level (beginner → pro)
3. Arm speed (slow/medium/fast/unknown)
4. Preferred putter (yes/no + search)
5. Brand preferences (multi-select or any)
6. Budget slider (kr 500–5000+)
7. Plastic type (standard/premium/mix)

Submits to `/api/bag/generate` on complete.

### AI Bag Generation (`app/api/bag/generate/route.ts`)
POST endpoint → Claude Sonnet 4 (`claude-sonnet-4-20250514`) → returns structured bag JSON.

Recommends 12–16 discs across driver/fairway/midrange/putter categories, respecting brand, budget, arm speed, and skill level. Returns:
```ts
type BagDisc = {
  slug: string;
  category: "driver" | "fairway" | "midrange" | "putter";
  quantity: 1 | 2;
  reason: string;
};
```

Requires `ANTHROPIC_API_KEY` env var.

### Bag Display (`app/bag/[id]/`)
- Server: decodes base64url bag ID, validates structure, 404 on invalid
- Client: `BagPageClient.tsx`
  - Dark green hero with player profile summary
  - Disc grid grouped by category, with image, flight numbers, price
  - Rotation badge (×2) for duplicates
  - Tooltip showing AI-generated reason per disc
  - **FlightCoverageChart** — SVG plot of speed vs. stability for all bag discs
  - Recommended bag gear section (GRIP, Discmania, Dynamic Discs)
  - Share (copy link) + Rebuild buttons

### Shared Components (`components/`)
- `Navbar.tsx` — site header
- `Hero.tsx` — search + tab pills
- `HotDrops.tsx` — carousel
- `Upcoming.tsx` — pre-release grid
- `AllDiscs.tsx` — responsive 3-col disc grid
- `DiscImage.tsx` — image with brand-initials fallback
- `FlightNumbers.tsx` — S · G · T · F display

### Utilities (`lib/disc-utils.ts`)
- `toNOK(price, currency)` — currency conversion
- `getBestInStockNOK(disc)` — best price + store count
- `isOnSale(disc)` — compare current vs. historical max
- `matchesSearch(disc, query)` — fuzzy search
- `releaseBadge(disc)` — badge type
- `badgeStyles(badge)` — Tailwind classes
- `filterByTab(discs, tab)` — category filter

---

## File Structure

```
app/
  api/bag/generate/route.ts   — Claude API endpoint
  bag/build/page.tsx          — 7-step wizard
  bag/[id]/page.tsx           — Server wrapper
  bag/[id]/BagPageClient.tsx  — Bag display
  disc/[slug]/page.tsx        — Server wrapper
  disc/[slug]/DiscDetailClient.tsx — Charts + tables
  disc-drop-home.tsx          — Home page content
  globals.css                 — Tailwind + design tokens
  layout.tsx                  — Root layout + fonts
  page.tsx                    — Home entry point
components/
  AllDiscs.tsx
  DiscImage.tsx
  FlightNumbers.tsx
  Hero.tsx
  HotDrops.tsx
  Navbar.tsx
  Upcoming.tsx
data/
  discs.js                    — Mock catalog + exchange rates
lib/
  disc-utils.ts               — Business logic utilities
public/
  logo.svg
```

---

## Design Tokens

Defined in `app/globals.css` via `@theme inline`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#0f1f17` | Page background |
| `--color-foreground` | `#f2f5ee` | Default text |
| `--color-surface` | `#162e1e` | Cards / panels |
| `--color-accent` | `#b8e04a` | Lime accent (CTAs, highlights) |
| `--color-muted` | `#7a9a82` | Secondary text |
| `--color-alert` | `#e8704a` | Warnings / sale badges |
| `--font-sans` | DM Sans | Body text |
| `--font-heading` | Syne | Headings |

Additional inline colors used in components (not yet tokenized):
- `#2D6A4F` — primary forest green
- `#1E3D2F` — dark panel backgrounds
- `#4CAF82` — lighter green accents

---

## Data Shape (`data/discs.js`)

```ts
type Disc = {
  id: string;
  name: string;
  brand: string;
  type: "driver" | "midrange" | "putter";
  flight: { speed: number; glide: number; turn: number; fade: number };
  image?: string;
  player?: string;         // Signature/tour disc player name
  releaseYear?: number;
  tags: string[];          // "hot", "new", "limited", "tour-series", "sold-out", "upcoming"
  priceHistory: (number | null)[];  // 12-month NOK prices, null = no data
  stores: Array<{
    name: string;
    price: number;
    currency: "NOK" | "SEK" | "DKK" | "EUR" | "USD";
    inStock: boolean;
    url: string;
    voec: boolean;         // true = VAT already included (no extra 25% MVA)
  }>;
};
```

**Exports from `data/discs.js`:**
- `discs` — full catalog (11 discs)
- `hotDrops` — discs with hot/featured tags
- `upcoming` — pre-release discs
- `exchangeRates` — `{ USD: 10.72, EUR: 11.58, GBP: 13.45, SEK: 0.98, DKK: 1.55, NOK: 1.00 }`
- `landedCostNOK(price, currency, shipping, voec)` — total with 25% MVA + handling fees

---

## Build My Bag — Feature Status

**Complete:**
- 7-step wizard UI with progress bar, back/forward navigation
- All input types: radio cards, multi-select, slider, search-and-select
- API route wired to Anthropic SDK
- Claude prompt structured to return valid JSON bag
- JSON parsing with error handling + retry UI
- Bag display page: disc grid, flight chart, tooltips, share/rebuild
- Base64url bag ID encoding/decoding
- Server-side validation of bag on `/bag/[id]`

**Not yet built:**
- Actually matching Claude's slug recommendations to `data/discs.js` entries (currently displays whatever slugs Claude returns, which may not exist in catalog)
- Price display on bag disc cards (requires slug → disc lookup)
- Persisting bags (currently ephemeral — link encodes full bag state)
- Email/notification system for price alerts (form exists, no backend)

---

## Priorities for Next Session

1. **Slug resolution in bag display** — look up each `BagDisc.slug` in `data/discs.js` to show real images, prices, and flight numbers. Handle missing slugs gracefully (show placeholder).
2. **Expand mock catalog** — 11 discs is too few for meaningful bag recommendations. Add 30–50 discs covering the full flight number range.
3. **Tokenize remaining inline colors** — `#2D6A4F`, `#1E3D2F`, `#4CAF82` should become CSS custom properties.
4. **Wire up search on Navbar** — the search button exists but isn't connected to the Hero search state.
5. **Price alert backend** — `/api/alerts/create` route storing email + disc + target price (even just to a JSON file initially).
6. **Real scraper / data layer** — replace `data/discs.js` with fetched data from Norwegian disc golf retailers.
