// GET /api/alerts/unsubscribe?id=<alertId> — deactivate an alert
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Mangler ID", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const result = await env.DB.prepare(
    "UPDATE alerts SET active = 0 WHERE id = ?"
  )
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return new Response(
      "<!DOCTYPE html><html lang='nb'><head><meta charset='utf-8'><title>DiscDrop</title></head><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Varsel ikke funnet</h2><p>Varselet er allerede avsluttet eller finnes ikke.</p><a href='https://discdrop.net'>Tilbake til DiscDrop</a></body></html>",
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    "<!DOCTYPE html><html lang='nb'><head><meta charset='utf-8'><title>DiscDrop</title></head><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Varsel avsluttet</h2><p>Du vil ikke lenger motta prisvarsler for denne disken.</p><a href='https://discdrop.net'>Tilbake til DiscDrop</a></body></html>",
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
