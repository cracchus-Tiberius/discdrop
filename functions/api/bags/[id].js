// GET /api/bags/:id — fetch a previously saved bag by id.
export async function onRequestGet({ params, env }) {
  const id = params.id;
  if (!id || typeof id !== "string") {
    return Response.json({ error: "Mangler ID" }, { status: 400 });
  }

  const row = await env.DB.prepare("SELECT data FROM bags WHERE id = ?").bind(id).first();
  if (!row) {
    return Response.json({ error: "Bag ikke funnet" }, { status: 404 });
  }

  // `data` is already a JSON string — return it as-is rather than
  // parse+restringify.
  return new Response(row.data, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
