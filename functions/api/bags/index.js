// POST /api/bags — save an AI-generated bag so /bag/[id] resolves on any
// device, not just the browser that generated it (which is all localStorage
// can do — the "Del bag" share button was copying a link that only worked
// locally).
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // Generous but bounded — a real bag payload (summary + ~10 discs + tips) is
  // a few KB; this just guards against abuse.
  if (body.length > 20000) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let stored;
  try {
    stored = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!stored || !Array.isArray(stored.discs) || stored.discs.length === 0) {
    return Response.json({ error: "Invalid bag payload" }, { status: 400 });
  }

  // Short id, matching the scheme the client used to generate locally.
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  function randomId() {
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomId();
    try {
      await env.DB.prepare("INSERT INTO bags (id, data) VALUES (?, ?)")
        .bind(id, JSON.stringify(stored))
        .run();
      return Response.json({ id });
    } catch (err) {
      // Primary key collision — extremely unlikely at 6 chars, but retry
      // rather than fail outright.
      if (attempt === 4) {
        console.error("bags POST error:", err);
        return Response.json({ error: "Serverfeil" }, { status: 500 });
      }
    }
  }
}
