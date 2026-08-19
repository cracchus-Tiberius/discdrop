@AGENTS.md

# DiscDrop — Claude Code Memory

## Project
Disc golf price comparison site for Norway. Live at discdrop.net.
Stack: Next.js 16, TypeScript, Tailwind, Cloudflare Pages.
Package manager: pnpm (always use pnpm, never npm).

## Key Rules
- Language: Norwegian Bokmål throughout UI
- Use "disk/disker" not "disc/discer" in Norwegian text
- Don't use "disc" in Norwegian copy — only in brand names and proper nouns
- Never show mock/fake prices — only real scraped data from scraped-prices.json
- Never expose ANTHROPIC_API_KEY in frontend code
- Always run pnpm build before finishing any task
- Commit message format: short description of what changed

## Design System
- Background: #F5F2EB
- Primary green: #2D6A4F
- Lime accent: #B8E04A
- Hero bg: #1E3D2F
- Font: Playfair Display (serif headlines) + DM Sans (body)
- Navbar: logo left, links centered, pill hover effect

## Reference Docs
- docs/DiscDrop_Knowledge_Base.md — disc brands, plastic types, player sponsorships, naming conventions, regex patterns for scraper matching. Read when building or updating scraper logic.

## Data
- discs.js — source of truth for disc catalogue (685 discs, 22 brands)
- scraped-prices.json — real store prices, updated by pnpm scrape
- Only show prices from scraped-prices.json, never mock store data
- Run pnpm scrape to update prices from Norwegian stores
- top-sellers.json — drives "Populære disker" on the homepage. Refreshed every
  ~14 days by scripts/scrape-top-sellers.js (.github/workflows/refresh-top-sellers.yml,
  cron on the 1st/15th) from Infinite Discs' rolling "top selling last month" page,
  matched to our catalog and filtered to discs with real store coverage. Kastaplast
  Berg is pinned at the top regardless of the feed — a US retailer's ranking won't
  surface a Scandinavian-market favorite. Run manually with: pnpm scrape:top-sellers

## Scraper
- scripts/scrape-all.js runs every store scraper in sequence (10-min timeout each,
  20 min for Aceshop — see comment there). One failure doesn't block the rest.
- Stores scraped, in run order: WeAreDiscGolf/Kvam DGS/Arctic Disc (scripts/scraper.js,
  WooCommerce + Shopify JSON APIs), Aceshop, Frisbeebutikken, Starframe, GolfDiscer,
  Frisbee Sør, NyDisk, DiscShopen (Norwegian, NOK — no currency conversion), Discexpress,
  Rocketdiscs, Discsport, Ugglans Discgolf, Discace of Sweden (Swedish/EU — SEK or EUR,
  converted to NOK with a live exchange rate at scrape time, VOEC-registered so MVA is
  included at checkout). Discace runs a "Disc Replay" used-disc category — filtered via
  USED_KEYWORDS/SKIP_CATEGORY_SLUGS (begagnad*) plus a local slug check. Starframe (Hamar)
  runs on the same Mystore platform as Frisbeebutikken — same addToCart() JS-object-
  literal parsing, see scripts/scrape-starframe.js.
- Each standalone scrape-*.js tries the store's JSON API first (Shopify products.json
  or WooCommerce wp-json/wc/store/v1/products), falls back to Playwright HTML scraping
  if that's blocked or unavailable.
- Scraping is automated via GitHub Actions (.github/workflows/daily-scrape.yml)
  Runs daily at 06:00 UTC (08:00 Norway). Manual runs only needed for testing.
- Run manually with: pnpm scrape:all (or pnpm scrape:nydisk / pnpm scrape:discshopen
  etc. for a single store)
- Output: data/scraped-prices.json + data/unmatched-products.json

## API Route
- The site builds with `output: "export"` (pure static, deployed as `out/`) — Next.js
  Route Handlers under app/api/ never ship. All server-side endpoints are Cloudflare
  Pages Functions under functions/api/, using env.* bindings, not process.env.
- functions/api/bag/generate.js — AI bag builder, calls Anthropic API directly via fetch
  (not the SDK, for Workers-runtime compatibility). Model: claude-sonnet-5.
  Key: env.ANTHROPIC_API_KEY (set as a Cloudflare Pages environment variable/secret).
- functions/api/alerts/ — price/back-in-stock alerts, reads/writes the `DB` D1 binding.
- Local testing of functions/ requires `wrangler pages dev` (plain `next dev` won't
  serve them) — see wrangler.toml for the D1 binding.

## Deploy
npx wrangler pages deploy out --project-name=discdrop --commit-dirty=true
Automated via GitHub Actions after each daily scrape.
Manual deploy still works for hotfixes.
