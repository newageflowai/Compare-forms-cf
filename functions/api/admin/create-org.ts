export async function onRequestPost({ request, env }: any) {
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return new Response("Missing org name", { status: 400 });

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/organizations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({ name })
  });

  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
