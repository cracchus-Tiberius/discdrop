# DiscDrop — Project Context Brief
*Paste this at the start of a new chat to continue where we left off.*

## What is DiscDrop?
Disc golf price comparison website for the Norwegian market.
Users search for a disc and instantly see which Norwegian stores 
carry it, at what price, including full landed cost (shipping + 25% MVA).

**Live at: discdrop.net**
**GitHub: github.com/cracchus-Tiberius/discdrop**

## Company
Private project by Torbjørn Iversen.
Company: Kviist / Kviist Studio (creative/tech studio)

## Brand
- Name: DiscDrop
- Tagline: Finn din disc. Skip the legwork.
- Background: #F5F2EB (cream)
- Primary: #2D6A4F (dark green)
- Accent: #B8E04A (lime)
- Hero: #1E3D2F (deep green)
- Aesthetic: Nordic/editorial, clean, minimal
- Contact: kontakt@discdrop.net

## Tech Stack
- Framework: Next.js 16 (App Router, static export)
- Language: TypeScript
- Styling: Tailwind CSS + globals.css
- Package manager: pnpm
- Hosting: Cloudflare Pages
- Deploy: npx wrangler pages deploy out --project-name=discdrop
- Dev: pnpm dev → localhost:3000

## File Structure
```
app/
  page.tsx — homepage server component
  disc-drop-home.tsx — main homepage component
  layout.tsx — fonts + metadata
  globals.css — brand tokens
  disc/[slug]/
    page.tsx — disc detail server component
    DiscDetailClient.tsx — client component
  browse/
    page.tsx — browse all discs with filters
  bag/
    build/page.tsx — Build My Bag wizard (7 steps)
    [id]/
      page.tsx — bag result server component
      BagPageClient.tsx — bag result client component
  api/
    bag/generate/route.ts — Anthropic API route
  personvern/page.tsx — privacy policy (Norwegian)
  sitemap.ts — dynamic sitemap
components/
  SearchInput.tsx — shared search dropdown component
data/
  discs.js — 172 discs with flight numbers
  scraped-prices.json — real prices from 3 Norwegian stores
  unmatched-products.json — scraper output for review
lib/
  disc-utils.ts — getMergedStores, price helpers
scripts/
  scraper.js — price scraper (run with pnpm scrape)
public/
  logo.svg — DiscDrop logo
  robots.txt
```

## What's Built ✅
- Homepage — hero, search dropdown, Hot Drops, Upcoming, Popular 6
- Browse page — 172 discs, search, smart filter chips, dropdowns
- Disc detail page — flight numbers, store prices, flight path chart
- Build My Bag — 7-step wizard + AI result page (Anthropic API)
- Price scraper — 3 Norwegian stores, real prices on 138 discs
- SEO — metadata on all pages, sitemap, robots.txt
- Compliance — privacy policy, footer, affiliate disclaimer
- Norwegian language throughout (Bokmål)
- Cloudflare deployment + discdrop.net domain
- kontakt@discdrop.net email forwarding → Gmail

## Norwegian Stores
| Store | Platform | Scraper status |
|---|---|---|
| wearediscgolf.no | WooCommerce | ✅ Scraping |
| kvamdgs.no | Shopify | ✅ Scraping |
| arcticdisc.no | Shopify | ✅ Scraping |
| aceshop.no | WooCommerce | ❌ Bot protection |
| frisbeesor.no | WooCommerce | ❌ Bot protection |
| golfdiscer.no | WooCommerce | ❌ Bot protection |
| frisbeebutikken.no | WooCommerce | ❌ Bot protection |
| krokholdgs.no | Mystore.no | ❌ Not attempted |
| nydisk.no | Unknown | ❌ Rate limited |

## Anthropic API
- Model: claude-sonnet-4-20250514
- Used for: Build My Bag recommendations
- Key stored in: Cloudflare env variable + .env.local
- Route: /api/bag/generate

## Norwegian Import Tax Rules
- Customs duty: 0%
- MVA: 25% on full CIF value
- Formula: (disc + shipping) × 1.25 = landed cost
- VOEC: foreign stores registered collect MVA at checkout

## Monetisation Plan
- Affiliate commissions (5-15% per sale)
- Featured store listings (kr 500-2000/month)
- Build My Bag equipment upsell
- Email price alerts list
- Display advertising (Year 2)

## Next Priorities
1. Fix WooCommerce stores with Playwright headless scraper
2. Plastic type grouping on disc detail page
3. Mobile sticky search (scroll to top on browse)
4. Connect Cloudflare auto-deploy from GitHub
5. Store outreach emails (affiliate deals)
6. Community launch (Reddit, Facebook groups)
7. Compliance prompt (rate limiting, API key security)
8. OpenClaw setup for remote building

## Known Issues / TODO
- Homepage hero occasionally disappears after builds — check disc-drop-home.tsx
- Price history chart hidden (no real historical data yet)
- 4 WooCommerce stores need Playwright to scrape
- Auto-deploy from GitHub not working — manual Wrangler deploy needed
- Disc images mostly missing — need to add URLs to discs.js manually
- "Disc" vs "Disk" — Norwegian spelling, use "disk/disker" throughout

## Deploy Command
```bash
cd ~/DiscDrop
pnpm build
npx wrangler pages deploy out --project-name=discdrop --commit-dirty=true
```