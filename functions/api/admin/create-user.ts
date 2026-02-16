export async function onRequestPost({ request, env }: any) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "").trim();
  const full_name = String(body?.full_name || "").trim();
  const role = body?.role === "admin" ? "admin" : "user";
  const org_id = body?.org_id || null;

  if (!email || !password) return new Response("Missing email/password", { status: 400 });

  // 1) Create Supabase Auth user (Admin API)
  const createUser = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true
    })
  });

  const created = await createUser.json().catch(() => null);
  if (!createUser.ok) {
    return new Response(JSON.stringify(created), { status: createUser.status, headers: { "Content-Type": "application/json" } });
  }

  const user_id = created?.id;
  if (!user_id) return new Response("User created but missing id", { status: 500 });

  // 2) Insert profile
  const profRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({ user_id, org_id, role, full_name })
  });

  const profText = await profRes.text();
  return new Response(profText, { status: profRes.status, headers: { "Content-Type": "application/json" } });
}
