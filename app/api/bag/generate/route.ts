import Anthropic from "@anthropic-ai/sdk";
import { discs } from "@/data/discs.js";

export type WizardAnswers = {
  throwingStyle: "backhand" | "forehand" | "both";
  skillLevel: "beginner" | "intermediate" | "advanced" | "pro";
  armSpeed: "slow" | "medium" | "fast";
  preferredPutter: string | null;
  brands: string[];
  budget: number;
  plastic: "standard" | "premium" | "mix";
};

export type BagDisc = {
  slug: string;
  category: "driver" | "fairway" | "midrange" | "putter";
  quantity: 1 | 2;
  reason: string;
};

export type BagData = {
  answers: WizardAnswers;
  discs: BagDisc[];
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let answers: WizardAnswers;
  try {
    answers = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const catalog = discs.map((d) => ({
    id: d.id,
    name: d.name,
    brand: d.brand,
    type: d.type,
    speed: d.flight.speed,
    glide: d.flight.glide,
    turn: d.flight.turn,
    fade: d.flight.fade,
  }));

  const prompt = `You are an expert disc golf bag builder. Recommend discs from this catalog to build the right bag for this player.

PLAYER PROFILE:
- Throwing style: ${answers.throwingStyle}
- Skill level: ${answers.skillLevel}
- Arm speed: ${answers.armSpeed}
- Preferred putter: ${answers.preferredPutter ? `"${answers.preferredPutter}" (include this)` : "no preference, recommend best options"}
- Brand preference: ${answers.brands.length === 0 ? "any brand" : answers.brands.join(", ")}
- Budget: kr ${answers.budget} NOK total
- Plastic preference: ${answers.plastic}

AVAILABLE DISC CATALOG (use only these — id field is the slug):
${JSON.stringify(catalog, null, 2)}

INSTRUCTIONS:
- Recommend as many discs as make sense for this player from the catalog above
- Aim for roughly: 3-4 distance drivers, 2-3 fairway/control drivers (lower speed), 3-4 midranges, 3-4 putters
- Use category "driver" for speed 9+, "fairway" for speed 6-8, "midrange" for speed 3-5, "putter" for speed 1-3
- Set quantity=2 for the player's primary workhorse discs they'll throw constantly (rotation discs)
- For beginners/slow arm: favor understable discs (negative turn), avoid high-overstable discs
- For advanced/pro/fast arm: include a mix including overstable options
- If player specified brands, prioritise those but include others if needed to build a complete bag
- The reason must be specific to this player's profile (mention their arm speed, skill, style)

Return ONLY a JSON array with this exact shape, nothing else:
[
  {
    "slug": "disc-id-from-catalog",
    "category": "driver" | "fairway" | "midrange" | "putter",
    "quantity": 1 | 2,
    "reason": "One sentence specific to this player"
  }
]`;

  const client = new Anthropic();

  let bagDiscs: BagDisc[];
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const text = content.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");
    bagDiscs = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(bagDiscs) || bagDiscs.length === 0) {
      throw new Error("Empty or invalid response array");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate bag: ${message}` },
      { status: 500 }
    );
  }

  return Response.json({ discs: bagDiscs });
}
