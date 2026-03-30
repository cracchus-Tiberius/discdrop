// POST /api/alerts — register a price alert
export async function onRequestPost({ request, env }) {
  try {
    const { discId, email, targetPrice } = await request.json();

    if (!discId || !email || !targetPrice) {
      return Response.json({ error: "Mangler felt" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Ugyldig e-postadresse" }, { status: 400 });
    }

    if (typeof targetPrice !== "number" || targetPrice < 1 || targetPrice > 10000) {
      return Response.json({ error: "Ugyldig målpris" }, { status: 400 });
    }

    // Deduplicate: check if same email+disc+price already exists
    const existing = await env.DB.prepare(
      "SELECT id FROM alerts WHERE email = ? AND disc_id = ? AND target_price = ? AND active = 1"
    )
      .bind(email, discId, Math.round(targetPrice))
      .first();

    if (existing) {
      return Response.json({ ok: true, message: "Varsel allerede registrert" });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO alerts (id, disc_id, email, target_price) VALUES (?, ?, ?, ?)"
    )
      .bind(id, discId, email, Math.round(targetPrice))
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("alerts POST error:", err);
    return Response.json({ error: "Serverfeil" }, { status: 500 });
  }
}
