import Anthropic from "@anthropic-ai/sdk";

type WizardAnswers = {
  level: string;
  throwingStyle: string;
  needs: string[];
  budget: string | null;
  brands: string[];
  discCount: string | null;
};

export type ApiDisc = {
  name: string;
  brand: string;
  type: string;
  plastic: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  priceNOK: number;
  reason: string;
  slug: string;
};

export type BagApiResponse = {
  summary: string;
  discs: ApiDisc[];
  bagTips: string;
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  if (body.length > 1024) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let answers: WizardAnswers;
  try {
    answers = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const systemPrompt =
    "You are an expert disc golf caddie helping players build their bag. " +
    "You have deep knowledge of disc golf discs, flight characteristics, " +
    "and player development. Always respond with valid JSON only — " +
    "no preamble, no markdown, no explanation outside the JSON. " +
    "All text fields (summary, reason, bagTips) must be written in Norwegian Bokmål.";

  const throwingStyleMap: Record<string, string> = {
    rhbh: "Right-hand backhand (RHBH)",
    lhbh: "Left-hand backhand (LHBH)",
    forehand: "Primarily forehand / flick",
    both: "Both backhand and forehand",
  };
  const levelMap: Record<string, string> = {
    beginner: "Beginner (under 1 year, learning basics)",
    intermediate: "Intermediate (1–3 years, ~60–80m)",
    advanced: "Advanced (3+ years, 80m+)",
    pro: "Pro / Elite (tournament player or sponsored)",
  };
  const needsStr = answers.needs.length > 0
    ? answers.needs.join(", ")
    : "full bag";
  const brandsStr = answers.brands.length > 0 && !answers.brands.includes("no-preference")
    ? answers.brands.join(", ")
    : "any brand";
  const discCountStr = answers.discCount ?? "6-10";

  const userPrompt = `Build a disc golf bag for this player:
- Skill level: ${levelMap[answers.level] ?? answers.level}
- Throwing style: ${throwingStyleMap[answers.throwingStyle] ?? answers.throwingStyle}
- Needs / goals: ${needsStr}
- Budget: ${answers.budget ?? "no limit"}
- Preferred brands: ${brandsStr}
- Desired disc count: ${discCountStr}

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
      "priceNOK": 249,
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
- Keep priceNOK realistic: putters 149-199, mids 179-229, drivers 199-299
- The slug should be brand-name in lowercase with hyphens`;

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const result: BagApiResponse = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(result.discs) || result.discs.length === 0) {
      throw new Error("Invalid response structure");
    }

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate bag: ${message}` },
      { status: 500 }
    );
  }
}
