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

## Hard-earned rules
- Frozen weeks are immutable: files in data/new-in-stores/<year>-W<week>.json
  for completed ISO weeks must never be regenerated, "cleaned up", or
  rewritten — they are the public archive behind /nytt/[year]-uke-[week]
  and are indexed by Google. Only the current live week is recomputed.
  `--force-refreeze` exists solely for deliberate bug fixes and requires
  an explicit decision from Tobba in the session — never run it as part
  of routine maintenance, refactors, or "tidying".

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

## Matcher-regler
- Mold-matching skal være case-insensitiv og mellomrom/bindestrek-insensitiv
  (Cloud Breaker = CloudBreaker = Cloudbreaker). Sammenlign på ordgrense-vindu,
  ikke fri substring: å strippe mellomrom globalt og så gjøre `includes()` gir
  falske treff ("wasp" i "glow aspect", "nova" i "innova", "fire" i "hellfire").
  Normaliser hvert n-gram-vindu av produkttittelen og krev likhet mot
  katalognavnet.
- Ved umatchede produkter: klassifiser alltid (a) ekte ny mold → ny
  discs.js-oppføring vs (b) skrivevariant → alias/normalisering i matcher.
  Aldri duplikat-oppføringer.
- Kjente alias-feller: Cloudbreaker, Q-Line/Q-Line Premier, Kaxe Z,
  nickname-first Discmania-titler.
- Ved katalogutvidelse/butikk-onboarding undertrykkes new-disc-signaler den
  dagen (mass-reset) — sjekk manuelt om ekte drops druknet.

## Scraper
- scripts/scrape-all.js runs every store scraper in sequence (10-min timeout
  each). One failure doesn't block the rest.
- Stores scraped, in run order: WeAreDiscGolf/Kvam DGS/Arctic Disc/HyzerShop/Disc Golf
  Dynasty/Disc Sør (all in scripts/scraper.js — WooCommerce + Shopify JSON APIs;
  HyzerShop/Disc Golf Dynasty are Shopify, Disc Sør is WooCommerce, same as
  WeAreDiscGolf; Aceshop is WooCommerce too and joined them 2026-09-05),
  Frisbeebutikken, Starframe, Krokhol, GolfDiscer,
  Frisbee Sør, NyDisk, DiscShopen (Norwegian, NOK — no currency conversion), Discexpress,
  Rocketdiscs, Discsport, Ugglans Discgolf, Discace of Sweden (Swedish/EU — SEK or EUR,
  converted to NOK with a live exchange rate at scrape time, VOEC-registered so MVA is
  included at checkout). Discace runs a "Disc Replay" used-disc category — filtered via
  USED_KEYWORDS/SKIP_CATEGORY_SLUGS (begagnad*) plus a local slug check.
- 19 stores total. The count is never hardcoded in the UI — /butikker and the
  homepage chip both derive it from data/scraped-prices.json's `stores` block, so
  adding a store updates them on the next scrape. data/store-profiles.js is the
  exception: it carries hand-written tagline/blurb copy and only covers 13 of the
  stores; /butikker renders a barer card for the rest rather than inventing copy.
- Mystore stores (Frisbeebutikken, Starframe/Hamar, Krokhol) all run off
  scripts/lib/mystore.js — one shared implementation, each store a config object
  (key/name/baseUrl/categoryUrl(s)/shipping/pageUrl). The lib handles both Mystore
  card renderings: the addToCart() Alpine JS-object-literal form that Frisbeebutikken
  and Starframe serve, and the server-rendered card markup Krokhol's theme serves
  (where the brand comes from data-manufacturer, not the visible title). Krokhol has
  no "all discs" parent category, so it lists five type categories and de-duplicates
  by product URL.
- Aceshop's WAF 403s the shared USER_AGENT — the Windows Chrome/124.0.0.0
  string, a very common scraper fingerprint. Confirmed 2026-09-05: that exact
  string 403s on both HTML and the JSON API, while Chrome/140, the same version
  on macOS, and an honest identifying UA all return 200 from the same IP. Its
  store entry carries a `userAgent` override; scraper.js's uaFor() applies any
  store's override over the shared default. Prefer an identifying UA over a
  newer spoofed Chrome — the spoof only stays unblocked until it ages onto a
  blocklist too.
- The SEK->NOK rate lives in scripts/lib/fx.js, shared by all four Swedish
  scrapers. Its fallback (used only when the rate API is unreachable) is a
  DATED observation, not a round number — the four scrapers previously carried
  their own copies falling back to 1.03/1.03/1.03/1.00 while the real rate was
  0.9724, overstating every Swedish price ~6% in the stores' favour. Each run
  records fxRate/fxRateSource/fxRateAt into that store's meta, so a Swedish
  price moving 199 -> 205 can be told apart from the krone moving. That is the
  currency-drift question in the /nytt launch checklist below.
- Each standalone scrape-*.js tries the store's JSON API first (Shopify products.json
  or WooCommerce wp-json/wc/store/v1/products), falls back to Playwright HTML scraping
  if that's blocked or unavailable.
- Scraping is automated via GitHub Actions (.github/workflows/daily-scrape.yml).
  Two crons, not one: a primary run at 04:30 UTC, and a 09:00 UTC catch-up
  that only actually scrapes if the primary didn't land (data still >=20h
  old) — added 2026-09-02 after GitHub's own scheduler ran hours late/
  missed a day outright, leaving the live site stale with nothing self-
  correcting it. .github/workflows/scrape-freshness-alert.yml is a separate
  10:00 UTC check that fails loudly (GitHub's normal failure-email) if data
  is still >26h old after both crons have had their chance — that's the
  "something is actually broken" signal, distinct from "just running late".
  Manual runs only needed for testing.
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

## Launch: /nytt public release ("uke 35-lanseringen")
"Uke 35-lanseringen" = making the /nytt ("Nytt i butikk") feed page public — it's
been live but unlinked (launch-gated) since week 34, waiting for 1-2 weeks of
stable signal counts before linking it from nav/sitemap. Update this checklist's
status as items get resolved; keep it here until the launch actually ships, then
delete this section.

**Launch gate** (must report clean before flipping the gate):
1. /nytt signal counts for ISO weeks 34 and 35 per type (new-disc / new-release /
   new-at-store) + any mass-reset suppression events. Target: ~5-25 signals/week,
   no leaks. Source: data/new-in-stores/ (one frozen file per ISO week,
   rebuilt every scrape — see scripts/lib/new-in-stores.js's "Week freezing").
2. Any price below the 50 NOK floor (MIN_VALID_PRICE_NOK) — confirm which
   store/currency, confirm data/rejected-prices.json + lib/disc-utils.ts actually
   rejected it from display, fix any reporting path that doesn't apply the floor.
3. Spot-check a sample of a single store's week-over-week price drops against the
   live store to rule out currency-conversion drift vs a real sale.

**Launch tasks** (ship work, independent of the gate):
4. Add "Nytt i butikk" to main nav (components/SiteHeader.tsx's NAV_LINKS) + to
   app/sitemap.ts's static entries — currently unlinked from both.
5. /nytt redesign per the Claude Design mockup ("Nytt i butikk").
6. Homepage hero store count → derived from data, not hardcoded.
7. Favicon set (app/favicon.ico, app/icon.svg, app/apple-icon.png,
   public/icon-192.png, public/icon-512.png, public/site.webmanifest) matches
   current DiscDrop branding.
8. og:image (public/og.png, referenced from app/layout.tsx's openGraph/twitter
   metadata) matches the current 1b Pop redesign — not a pre-redesign screenshot.

## Deploy
npx wrangler pages deploy out --project-name=discdrop --commit-dirty=true
Automated via GitHub Actions after each daily scrape.
Manual deploy still works for hotfixes.
