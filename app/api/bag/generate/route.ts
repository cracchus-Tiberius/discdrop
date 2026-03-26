import Anthropic from "@anthropic-ai/sdk";

type WizardAnswers = {
  skillLevel: string;
  armSpeed: string;
  discTypes: string[];
  budget: string;
  ownedDiscs: string;
  courseTypes: string[];
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
    console.log("Error: ANTHROPIC_API_KEY is not configured");
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    console.log("Error: Failed to read request body");
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  console.log("API route called with:", body);

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
    "no preamble, no markdown, no explanation outside the JSON.";

  const discTypesStr =
    answers.discTypes.length > 0 ? answers.discTypes.join(", ") : "full bag";
  const courseTypesStr =
    answers.courseTypes.length > 0 ? answers.courseTypes.join(", ") : "mixed";

  const userPrompt = `Build a disc golf bag for this player:
- Skill level: ${answers.skillLevel}
- Arm speed: ${answers.armSpeed}
- Disc types wanted: ${discTypesStr}
- Budget: ${answers.budget}
- Discs already owned: ${answers.ownedDiscs || "none"}
- Course types: ${courseTypesStr}

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
- Recommend 8-12 discs total
- Match discs to the player skill level and arm speed
- For beginners: max speed 7, understable to neutral discs only
- For slow arm speed: understable discs, negative turn values
- For fast arm speed: overstable discs, neutral to positive turn
- Include a mix of types based on discTypes preference
- Use only real disc golf discs that actually exist
- Keep priceNOK realistic: putters 149-199, mids 179-229, drivers 199-299
- The slug should be brand-name in lowercase with hyphens`;

  const client = new Anthropic();

  try {
    console.log("Calling Anthropic API...");
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    console.log("Anthropic responded");
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
    console.log("Error:", message);
    return Response.json(
      { error: `Failed to generate bag: ${message}` },
      { status: 500 }
    );
  }
}
