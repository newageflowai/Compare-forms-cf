import { supabase } from "/assets/supabase.js";

const whoami = document.getElementById("whoami");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");
const formStatus = document.getElementById("formStatus");

function setStatus(type, msg) {
  if (!formStatus) return;
  formStatus.className = "status " + (type || "");
  formStatus.textContent = msg || "";
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    // not logged in -> send to login page
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadMyProfile(userId) {
  // This must be allowed by RLS for the logged-in user (select own row)
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,org_id,is_active")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function showAdminButtonIfAdmin(profile) {
  const role = String(profile?.role || "").toLowerCase();
  if (role === "admin") {
    adminLink.style.display = "";   // show
  } else {
    adminLink.style.display = "none";
  }
}

async function loadRecentEntries(profile) {
  // NOTE: This depends on your DB schema.
  // If you have a "recent_entries" view/table, use that.
  // Otherwise, you can union from your form tables later.

  recentBody.innerHTML = `<tr><td colspan="6" class="muted">No data yet.</td></tr>`;
  setStatus("", "");

  // If you already have a view/table like "recent_entries", use this:
  // Columns assumed: created_at, type, date, employee_name, notes, id, org_id
  const role = String(profile?.role || "").toLowerCase();
  const orgId = profile?.org_id ?? null;

  let q = supabase
    .from("recent_entries")  // <-- change this if your table/view is named differently
    .select("id, created_at, type, date, employee_name, notes, org_id")
    .order("created_at", { ascending: false })
    .limit(25);

  // Non-admin only sees their org
  if (role !== "admin") {
    q = q.eq("org_id", orgId);
  }

  const { data, error } = await q;

  if (error) {
    // If you don’t have the view/table yet, you’ll see an error here.
    setStatus("err", "❌ " + error.message);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">No recent entries.</td></tr>`;
    return;
  }

  recentBody.innerHTML = data.map(r => `
    <tr>
      <td>${fmtDate(r.created_at)}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.employee_name)}</td>
      <td>${escapeHtml(r.notes)}</td>
      <td class="mono">${escapeHtml(r.id)}</td>
    </tr>
  `).join("");
}

async function init() {
  try {
    const session = await requireSession();
    if (!session) return;

    setStatus("", "");
    whoami.textContent = "Loading…";

    const profile = await loadMyProfile(session.user.id);

    // Optional: block inactive
    if (profile?.is_active === false) {
      whoami.textContent = "Account disabled";
      adminLink.style.display = "none";
      setStatus("err", "❌ Your account has been deactivated.");
      await supabase.auth.signOut();
      window.location.href = "/index.html";
      return;
    }

    // Show name/email + org
    whoami.textContent = `Signed in as ${profile.email || session.user.email} • Role: ${String(profile.role || "user").toUpperCase()}`;

    // ✅ Show Admin button only for admin
    showAdminButtonIfAdmin(profile);

    // Load recent entries
    await loadRecentEntries(profile);

  } catch (e) {
    console.error(e);
    whoami.textContent = "Error";
    setStatus("err", "❌ " + (e?.message || "Failed to load"));
  }
}

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
});

refreshBtn?.addEventListener("click", init);

// Re-run when auth changes (login/logout in another tab)
supabase.auth.onAuthStateChange((_event, _session) => {
  init();
});

init();
