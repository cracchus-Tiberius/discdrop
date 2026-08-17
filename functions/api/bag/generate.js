// POST /api/bag/generate — AI-generated disc golf bag via the Anthropic API.
//
// This used to live at app/api/bag/generate/route.ts as a Next.js Route Handler,
// but next.config.ts builds with output: "export" (pure static site deployed as
// `out/`) — Next never emits that route into the static export, so the endpoint
// 404'd in production and "Bygg min bag" silently never worked. Every other
// server-side endpoint in this project (see functions/api/alerts/) is a
// Cloudflare Pages Function instead, so this is ported to match.
import { discs } from "../../../data/discs.js";
import scrapedPrices from "../../../data/scraped-prices.json";

const MIN_VALID_PRICE_NOK = 50;
// Same accessory-mismatch guard as lib/disc-utils.ts's MAX_VALID_PRICE_NOK —
// without it a mismatched bag/rangefinder priced in the thousands could get
// fed to the LLM as if it were a real disc price and skew a bag suggestion.
const MAX_VALID_PRICE_NOK = 600;

// Mirrors lib/disc-utils.ts's entryLandedNOK() — keep both in sync.
function entryLandedNOK(entry, meta) {
  if (!meta) return entry.price;
  if (meta.freeShippingOver != null && entry.price >= meta.freeShippingOver) {
    return entry.price;
  }
  return entry.price + (meta.shipping ?? 0);
}

function getScrapedPrice(discId) {
  const scraped = scrapedPrices.prices[discId];
  if (!scraped || scraped.length === 0) return null;
  const storeMeta = scrapedPrices.stores;
  const inStock = scraped.filter(
    (s) => s.inStock && s.price >= MIN_VALID_PRICE_NOK && s.price <= MAX_VALID_PRICE_NOK
  );
  if (inStock.length === 0) return null;
  return Math.min(...inStock.map((s) => entryLandedNOK(s, storeMeta[s.store])));
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const catalogByNormalizedId = new Map(discs.map((d) => [normalize(d.id), d]));
const catalogByNormalizedName = new Map(
  discs.map((d) => [normalize(`${d.brand}${d.name}`), d])
);

/** LLM output is a guess at a real catalog disc — resolve it to the actual entry so we
 * can attach a real scraped price and a working /disc/[slug] link instead of trusting
 * whatever slug/price the model invented. */
function resolveCatalogDisc(apiDisc) {
  return (
    catalogByNormalizedId.get(normalize(apiDisc.slug)) ??
    catalogByNormalizedName.get(normalize(`${apiDisc.brand}${apiDisc.name}`))
  );
}

// Values sent by app/bag/build/page.tsx's brand pills -> the real `brand`
// field in data/discs.js. Used to hand the model an explicit inventory list
// when a preferred brand is picked, instead of letting it recommend
// whatever it "knows" about that brand in general — confirmed in
// production 2026-08-17: with "MVP" selected, the model suggested Volt,
// Format, and Axis, none of which are in our 51-disc MVP catalog, so they
// showed up with no image, no price, and a dead /disc/[slug] link.
const BRAND_SLUG_TO_NAME = {
  innova: "Innova",
  discmania: "Discmania",
  kastaplast: "Kastaplast",
  mvp: "MVP",
  discraft: "Discraft",
  latitude64: "Latitude 64",
};

const discNamesByBrand = new Map();
for (const d of discs) {
  if (!discNamesByBrand.has(d.brand)) discNamesByBrand.set(d.brand, []);
  discNamesByBrand.get(d.brand).push(d.name);
}

const SYSTEM_PROMPT =
  "You are an expert disc golf caddie helping players build their bag. " +
  "You have deep knowledge of disc golf discs, flight characteristics, " +
  "and player development. Always respond with valid JSON only — " +
  "no preamble, no markdown, no explanation outside the JSON. " +
  "All text fields (summary, reason, bagTips) must be written in Norwegian Bokmål.";

const THROWING_STYLE_MAP = {
  rhbh: "Right-hand backhand (RHBH)",
  lhbh: "Left-hand backhand (LHBH)",
  forehand: "Primarily forehand / flick",
  both: "Both backhand and forehand",
};

const LEVEL_MAP = {
  beginner: "Beginner (under 1 year, learning basics)",
  intermediate: "Intermediate (1–3 years, ~60–80m)",
  advanced: "Advanced (3+ years, 80m+)",
  pro: "Pro / Elite (tournament player or sponsored)",
};

function buildUserPrompt(answers) {
  const needsStr = answers.needs.length > 0 ? answers.needs.join(", ") : "full bag";
  // answers.brands holds slugs ("mvp"), not display names — map to real
  // brand names both for the prompt's own readability and to look up each
  // brand's real inventory below.
  const preferredBrandNames = (answers.brands || [])
    .filter((b) => b !== "no-preference")
    .map((b) => BRAND_SLUG_TO_NAME[b])
    .filter(Boolean);
  const brandsStr = preferredBrandNames.length > 0 ? preferredBrandNames.join(", ") : "any brand";
  // "10+" is what the wizard's button actually sends (app/bag/build/page.tsx)
  // — left open-ended in the prompt, the model has no reason not to
  // recommend 15-20 discs, each with a sentence of reasoning, which blew
  // through max_tokens and silently truncated the response (confirmed in
  // production 2026-08-17). Bound it to a real range instead.
  const DISC_COUNT_LABELS = { "3-5": "3-5", "6-10": "6-10", "10+": "10-14" };
  const discCountStr = DISC_COUNT_LABELS[answers.discCount] ?? answers.discCount ?? "6-10";

  // When one or more brands are preferred, hand the model the REAL list of
  // discs we carry for those brands so it can't recommend a disc that
  // doesn't exist in our catalog (see BRAND_SLUG_TO_NAME comment above for
  // the production case this fixes). Skipped for "any brand" — the full
  // 660-disc catalog is too much to include in every request, so that path
  // still relies on the UI's graceful handling of an unresolved disc.
  const inventoryNote =
    preferredBrandNames.length > 0
      ? `\n\nOnly recommend discs from this list of discs we actually carry for these brands — do not invent or suggest any disc outside this list:\n${preferredBrandNames
          .map((b) => `${b}: ${(discNamesByBrand.get(b) || []).join(", ")}`)
          .join("\n")}`
      : "";

  return `Build a disc golf bag for this player:
- Skill level: ${LEVEL_MAP[answers.level] ?? answers.level}
- Throwing style: ${THROWING_STYLE_MAP[answers.throwingStyle] ?? answers.throwingStyle}
- Needs / goals: ${needsStr}
- Budget: ${answers.budget ?? "no limit"}
- Preferred brands: ${brandsStr}
- Desired disc count: ${discCountStr}${inventoryNote}

Respond with a JSON object in exactly this format:
{
  "summary": "A 2-3 sentence description of this bag and why it suits this player",
  "discs": [
    {
      "name": "Destroyer",
      "brand": "Innova",
      "type": "Distance Driver",
      "plastic": "Star",
      "speed": 12,
      "glide": 5,
      "turn": -1,
      "fade": 3,
      "reason": "One sentence explaining why this disc suits this player",
      "slug": "innova-destroyer"
    }
  ],
  "bagTips": "One practical tip for this specific player about using their bag"
}

Rules:
- Recommend discs matching the desired count range (${discCountStr})
- Match discs to the player's skill level and throwing style
- For beginners: max speed 7, understable to neutral discs only
- For RHBH/LHBH throwers: recommend discs that fly correctly for that arm
- For forehand throwers: prefer overstable discs since forehand throws add stability
- Focus on the player's stated needs (${needsStr})
- Prefer the player's brand preferences if specified
- Use only real disc golf discs that actually exist
- The slug should be brand-name in lowercase with hyphens, matching the disc's actual product page slug`;
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  if (body.length > 1024) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let answers;
  try {
    answers = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        // 2048 was silently truncating "10+" (tournament bag) requests
        // mid-response — confirmed in production 2026-08-17: the model ran
        // out of budget before emitting a text block at all for a 10+/any-
        // brand/any-budget request, and JSON.parse failed with a "not
        // valid JSON" error for slightly smaller-but-still-large ones.
        // Even after bounding "10+" to "10-14" discs in the prompt above,
        // 4096 still wasn't enough headroom in testing — 14 discs x
        // (~10 fields incl. a sentence-long "reason" each) plus the
        // summary/bagTips prose needs real margin, not a tight fit.
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(answers) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const message = await anthropicRes.json();
    if (message.stop_reason === "max_tokens") {
      // Give a clear, specific error instead of letting this surface as a
      // confusing "Unexpected response type" / JSON-parse failure further
      // down — both of those are just downstream symptoms of a truncated
      // response, and a raised max_tokens (see above) should prevent this
      // in practice, but a wide-open "brands"/"needs" combo plus a large
      // discCount could still theoretically be big enough to hit it again.
      throw new Error("Bag suggestion was too large to generate — prøv et mindre antall disker.");
    }
    // Don't assume content[0] is the text block — a thinking block (when the
    // model does extended/interleaved reasoning) can come first.
    const content = message.content?.find((c) => c.type === "text");
    if (!content) {
      throw new Error("Unexpected response type");
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const result = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(result.discs) || result.discs.length === 0) {
      throw new Error("Invalid response structure");
    }

    // Never trust the model's own price or slug — resolve against the real catalog
    // and only show a price when we have real scraped data for it.
    result.discs = result.discs.map((disc) => {
      const match = resolveCatalogDisc(disc);
      return {
        ...disc,
        slug: match?.id ?? disc.slug,
        priceNOK: match ? getScrapedPrice(match.id) : null,
      };
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Failed to generate bag: ${message}` }, { status: 500 });
  }
}
