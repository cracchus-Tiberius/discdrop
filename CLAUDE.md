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
- discs.js — source of truth for disc catalogue (557 discs, 20 brands)
- scraped-prices.json — real store prices, updated by pnpm scrape
- Only show prices from scraped-prices.json, never mock store data
- Run pnpm scrape to update prices from Norwegian stores

## Scraper
- scripts/scraper.js — scrapes WeAreDiscGolf (WooCommerce) +
  Kvam DGS + Arctic Disc (Shopify JSON API)
- Run with: pnpm scrape
- Output: data/scraped-prices.json + data/unmatched-products.json
- Add --commit-dirty=true to wrangler deploy to suppress git warning

## API Route
- /api/bag/generate — Anthropic API, server-side only
- Model: claude-sonnet-4-20250514
- Key: process.env.ANTHROPIC_API_KEY

## Deploy
npx wrangler pages deploy out --project-name=discdrop --commit-dirty=true
GitHub auto-deploy not working — always use manual Wrangler deploy.
