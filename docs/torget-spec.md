# DiscDrop Marketplace — Feature Specification
## "Torget" — Buy, Sell & Trade Disc Golf Discs
**Version:** 1.0 | **Status:** Planning | **Priority:** Future Feature
**Author:** Kviist Studio | **Date:** March 2026

---

## 1. Overview

A peer-to-peer classifieds section on DiscDrop where Norwegian disc golfers can list discs for sale (used, unthrown collectors, or duplicates) and buyers can browse, search, and contact sellers directly.

**Model:** Classifieds / bulletin board (like Finn.no Torget)
**NOT:** A managed marketplace — DiscDrop does not handle payments, shipping, or escrow.

### 1.1 Why This Matters

- Norwegian disc golfers currently buy/sell used discs on Facebook groups with no search, no filtering, and no disc identification
- Finn.no exists but has no disc golf-specific features (no flight numbers, no condition rating, no plastic type)
- There is NO dedicated Norwegian/Nordic disc golf marketplace
- DiscDrop already has the disc database, images, and price data to make this 10x better than Facebook

### 1.2 Value Proposition

- **For sellers:** List in 60 seconds — DiscDrop auto-identifies the disc and fills in details
- **For buyers:** Search by disc name, brand, type, condition, location — impossible on Facebook
- **For DiscDrop:** Drives traffic, builds community, creates monetization opportunities

---

## 2. User Roles

### 2.1 Seller
- Must create an account (email verification required)
- Can create, edit, and delete their own listings
- Profile shows: display name, location (city/region), member since date, rating
- Can see their own active/expired/sold listings

### 2.2 Buyer
- Can browse and search without an account
- Must have an account to contact a seller or save favorites
- Can rate sellers after a completed transaction

### 2.3 Admin (Tobba / Kviist)
- Can remove listings (spam, fraud, non-disc items)
- Can ban users
- Can see reported listings

---

## 3. Listing Flow (Seller)

### 3.1 Create Listing — Step by Step

**Step 1: Identify the disc**
- Search field: "Hvilken disk selger du?"
- Auto-complete from DiscDrop's disc database (discs.js)
- When disc is selected, auto-fill: brand, type, flight numbers, stock image
- If disc not found: manual entry (name, brand, type)

**Step 2: Disc details**
- Plastic type: dropdown/pills populated from knowledge base for that brand
  - e.g. Kastaplast selected → show K1, K3, K1 Glow, K1 Soft, K3 Hard
- Edition: free text (e.g. "Tour Series 2025", "Ledgestone", or leave blank for standard)
- Weight: number input (150-180g)
- Color: free text or color picker
- Condition: selectable scale with descriptions:
  - 10/10 — Ny, aldri kastet
  - 9/10 — Kastet noen ganger, ingen synlig slitasje
  - 8/10 — Lett brukt, små merker
  - 7/10 — Brukt, synlig slitasje
  - 6/10 — Godt brukt, flyegenskaper kan være endret
- Ink: Yes/No toggle ("Har disken blekk/navn skrevet på?")

**Step 3: Photos**
- Upload 1-4 photos (required: minimum 1)
- Recommend: front, back, rim close-up, any damage
- Max file size: 5MB per image
- Auto-compress on upload

**Step 4: Price & Location**
- Price: number input in NOK
- Negotiable: toggle (Pris kan diskuteres)
- Trade: toggle (Åpen for bytte)
- Location: dropdown of Norwegian regions/cities
  - Oslo, Bergen, Trondheim, Stavanger, Kristiansand, Tromsø, etc.
  - Or free text
- Shipping: toggle (Kan sendes / Kun henting)
- Contact method: email (pre-filled from account) + optional phone number

**Step 5: Preview & Publish**
- Show preview of listing exactly as buyers will see it
- "Publiser annonse" button
- Listing goes live immediately (no approval queue to start)

### 3.2 Listing Lifecycle
- Active for 30 days by default
- Seller can renew (resets 30-day timer)
- Seller can mark as "Solgt" (sold) — listing stays visible but grayed out
- Seller can delete at any time
- Auto-expires after 30 days with email reminder at day 25

---

## 4. Browse & Search (Buyer)

### 4.1 Torget Main Page (/torget)
- Hero: "Finn brukte og ubrukte disker fra andre spillere"
- Search input (same component as Alle disker page)
- Filter chips: Alle, Putter, Midrange, Fairway, Driver, Ny (10/10), Under kr 100
- Sort: Nyeste, Laveste pris, Høyeste pris, Nærmest meg
- Grid of listing cards

### 4.2 Listing Card
- Seller's photo of the disc (primary image)
- Disc name + brand
- Plastic type + edition (if any)
- Condition badge (10/10, 9/10, etc.)
- Price in NOK
- Location (city)
- "Kan sendes" badge if shipping available
- Time since posted ("3 timer siden", "2 dager siden")

### 4.3 Listing Detail Page (/torget/[listing-id])
- Photo gallery (swipeable on mobile)
- Disc info section:
  - Name, brand, type badge
  - Flight numbers (auto-filled from DiscDrop database)
  - Plastic type, edition, weight, color
  - Condition rating with description
  - Ink status
- Price section:
  - "kr 150" large
  - "Pris kan diskuteres" if negotiable
  - "Åpen for bytte" if trade accepted
- **Price comparison callout:**
  - "Ny pris fra kr 249 (3 butikker)" — links to the disc's detail page on DiscDrop
  - This is a killer feature: buyer instantly sees if the used price is a good deal
- Seller info:
  - Display name
  - Location
  - Member since
  - Rating (stars + number of ratings)
  - "Kontakt selger" button → reveals email/phone
- Location map (optional, nice-to-have)
- Report button ("Rapporter annonse")

---

## 5. User Accounts

### 5.1 Registration
- Email + password
- Email verification required before posting
- Display name (shown publicly)
- Location (city/region)
- Optional: phone number (only shown on their listings if they choose)

### 5.2 Profile Page (/profil/[user-id])
- Display name, location, member since
- Rating (average stars + count)
- Active listings
- Sold listings (grayed out)

### 5.3 Authentication
- Simple email/password (no social login needed to start)
- Session-based or JWT
- "Glemt passord" flow with email reset

---

## 6. Rating System

### 6.1 How It Works
- After contacting a seller, the buyer can rate the seller (1-5 stars)
- Rating is optional
- Seller cannot rate buyers (keeps it simple)
- Minimum 3 ratings before average is displayed publicly
- Below 3 ratings: show "Ny selger" badge

### 6.2 Rating Criteria
- Simple: "Hvordan var din opplevelse med denne selgeren?"
- 1-5 stars, no text review required (optional comment)

---

## 7. Fraud Prevention & Legal

### 7.1 Platform Liability Disclaimer
Prominent on every listing page and in terms:

> "DiscDrop er en oppslagstavle for kjøp og salg mellom privatpersoner. 
> Vi formidler ikke betaling, forsendelse eller garantier. Alle transaksjoner 
> skjer direkte mellom kjøper og selger. DiscDrop er ikke ansvarlig for 
> varer, betaling eller tvister mellom partene."

### 7.2 Fraud Prevention Measures
- **Email verification** required to list (prevents throwaway accounts)
- **Report button** on every listing — triggers review
- **Auto-flag** listings with suspiciously low prices (e.g. Tour Series disc for kr 20)
- **Rate limiting** — max 10 new listings per day per account
- **Image required** — no listings without at least 1 photo
- **No external links** in listing descriptions (prevents phishing)
- **30-day auto-expire** — stale listings don't accumulate

### 7.3 Recommended Payment Methods
Show on every listing as a tip (not a requirement):
- **Vipps** — recommended (Norwegian mobile payment, familiar, has buyer protection)
- Cash on pickup
- Bank transfer

### 7.4 Terms of Use Addition
Add a "Torget" section to the existing personvern/terms page:
- DiscDrop is a classifieds platform, not a party to transactions
- Users are responsible for their own listings and transactions
- DiscDrop reserves the right to remove listings and ban users
- No illegal items, no counterfeit discs, only disc golf related items
- Users must be 18+ to create an account

---

## 8. Monetization

### 8.1 Phase 1 — Free (Launch)
- All listings free
- Goal: build critical mass of listings and users
- Track listing volume and engagement metrics

### 8.2 Phase 2 — Featured Listings
- "Fremhevet annonse" — kr 29 to pin listing at top for 7 days
- Visual distinction: highlighted card with "FREMHEVET" badge
- Payment via Vipps or Stripe

### 8.3 Phase 3 — Seller Subscriptions (Future)
- "Pro Selger" — kr 99/month
- Unlimited featured listings
- Profile badge
- Analytics (views, clicks on listings)

---

## 9. Technical Architecture

### 9.1 Database (Cloudflare D1)
Tables needed:

**users**
- id, email, password_hash, display_name, location, phone (optional)
- created_at, email_verified, is_banned

**listings**
- id, user_id, disc_slug (links to discs.js), disc_name, brand
- plastic, edition, weight, color, condition (1-10)
- has_ink (boolean), price, is_negotiable, accepts_trade
- location, can_ship, contact_email, contact_phone
- status (active/sold/expired), created_at, expires_at
- views_count

**listing_images**
- id, listing_id, image_url, sort_order

**ratings**
- id, rater_user_id, seller_user_id, listing_id
- stars (1-5), comment (optional), created_at

**reports**
- id, listing_id, reporter_user_id, reason, created_at, resolved

### 9.2 Image Storage
- Cloudflare R2 (S3-compatible object storage)
- Free tier: 10GB storage, 10 million reads/month
- Plenty for thousands of listing images
- Auto-compress on upload (sharp/jimp library)

### 9.3 API Routes (Next.js App Router)
- POST /api/torget/listings — create listing
- GET /api/torget/listings — search/filter listings
- GET /api/torget/listings/[id] — single listing
- PATCH /api/torget/listings/[id] — update (owner only)
- DELETE /api/torget/listings/[id] — delete (owner only)
- POST /api/torget/listings/[id]/report — report listing
- POST /api/auth/register — create account
- POST /api/auth/login — login
- POST /api/auth/verify — email verification
- POST /api/torget/ratings — rate a seller
- GET /api/torget/users/[id] — user profile + listings

### 9.4 Pages
- /torget — main marketplace browse page
- /torget/ny — create new listing (authenticated)
- /torget/[id] — listing detail page
- /torget/mine — my listings (authenticated)
- /profil/[id] — public user profile
- /konto — account settings (authenticated)
- /konto/registrer — registration
- /konto/logg-inn — login

---

## 10. Design Guidelines

### 10.1 Visual Integration
- Same DiscDrop design system (cream #F5F2EB bg, green #2D6A4F, lime #B8E04A)
- Torget gets its own nav item: Hjem | Hot Drops | Alle disker | **Torget** | Bygg min bag
- Listing cards follow same card pattern as disc browse cards
- Condition badges use color coding:
  - 10-9/10 = green
  - 8-7/10 = yellow/amber
  - 6/10 = orange
  - 5/10 and below = not allowed

### 10.2 Mobile First
- Listing creation must be easy on phone (camera → upload → fill details → publish)
- Photo upload from camera roll or take photo directly
- All touch targets 44px minimum
- Swipeable photo gallery on listing detail

---

## 11. Integration with Existing DiscDrop Features

### 11.1 Disc Database Link
- When a seller selects a disc, it links to discs.js
- Listing shows flight numbers, disc type automatically
- Listing detail page shows "Se nye priser →" link to the disc's price comparison page

### 11.2 Price Intelligence
- On listing detail: "Ny pris fra kr X" shows the cheapest new price from scraped stores
- Helps buyers evaluate if the used price is fair
- Helps sellers price competitively

### 11.3 Hot Drops Connection
- If someone lists a rare/limited edition disc, it could appear in Hot Drops
- "Tilgjengelig brukt" badge on Hot Drops cards when a used listing exists

### 11.4 Search Integration
- Torget listings appear in main search results with a "Brukt" badge
- User can toggle: "Vis også brukte disker i søk"

---

## 12. Launch Strategy

### Phase 1: Landing Page (1 session)
- Simple "/torget" page: "Kommer snart — Kjøp og selg disker på DiscDrop"
- Email signup: "Bli varslet når Torget åpner"
- Collect interest and validate demand
- Goal: 50+ signups before building

### Phase 2: MVP (2-3 sessions)
- User accounts (register/login/verify)
- Create, browse, search listings
- Basic listing detail page with seller contact
- No ratings yet, no featured listings
- Manual admin moderation

### Phase 3: Polish (1-2 sessions)
- Rating system
- Featured listings (monetization)
- Report flow
- Email notifications (new listings matching saved searches)
- "Solgt" marking flow

### Phase 4: Growth
- Promote on Reddit r/discgolf and Norwegian Facebook groups
- Partner with Norwegian disc golf clubs
- Consider expanding to Sweden/Denmark/Finland

---

## 13. Competitive Analysis

| Platform | Scope | Payment | Fee | Disc-specific features |
|----------|-------|---------|-----|----------------------|
| Facebook Groups | Global/local | External (Vipps, PayPal) | Free | None |
| Finn.no | Norway | External | Free/paid | None |
| r/discexchange | Global (US-heavy) | External (PayPal, Venmo) | Free | None |
| discXchange.com | US | External | Free | Disc identification |
| SidelineSwap | Global | In-platform | 10-15% | Generic sports gear |
| **DiscDrop Torget** | **Norway/Nordic** | **External (Vipps)** | **Free → Featured** | **Full disc database, flight numbers, condition scale, price comparison** |

DiscDrop's advantage: the disc database and price comparison data. No other marketplace can auto-identify a disc, show its flight numbers, AND compare the used price against new store prices. That's the moat.

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low initial listings | Users leave empty marketplace | Seed with 20-30 listings yourself, invite local club members |
| Fraud/scams | Trust damage | Email verification, ratings, report system, Vipps recommendation |
| Legal liability | Financial/legal risk | Clear terms disclaiming all transaction responsibility |
| Spam listings | Poor UX | Rate limiting, image requirement, auto-expire, report system |
| Facebook competition | Users stay on Facebook | Better search, disc identification, price comparison — things Facebook can't do |

---

*DiscDrop Torget — Feature Specification v1.0*
*Kviist Studio — March 2026*
*Store in: docs/torget-spec.md*
