// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

// Elements
const whoamiEl = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");

const formStatus = document.getElementById("formStatus");
const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");

// Panels
const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

// Tabs
const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDateTime(ts){
  try { return new Date(ts).toLocaleString(); } catch { return String(ts || ""); }
}
function fmtDateOnly(d){
  if (!d) return "";
  // Supabase date comes as "YYYY-MM-DD" (string)
  return String(d);
}

function setStatus(type, msg){
  if (!formStatus) return;
  formStatus.className = "status " + type; // ok | err
  formStatus.textContent = msg;
}
function clearStatus(){
  if (!formStatus) return;
  formStatus.className = "status";
  formStatus.textContent = "";
}

// ---------- Auth/Profile ----------
async function requireSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfile(userId){
  // Keep this select simple to avoid RLS recursion issues
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, org_id, first_name, last_name")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function fullName(profile){
  const first = String(profile?.first_name || "").trim();
  const last  = String(profile?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || "";
}

// ---------- Tabs ----------
function setActiveTab(key){
  tabButtons.forEach(btn => {
    const isActive = btn.getAttribute("data-tab") === key;
    btn.classList.toggle("active", isActive);
  });
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hide", k !== key);
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-tab");
    setActiveTab(key);
  });
});

// ---------- Recent Entries Loader (Safe only for now) ----------
async function fetchSafeRecent({ profile }){
  // We will try querying with NEW columns first (form_date/form_time),
  // and if Postgres says they don't exist, fall back to old (date/time).

  // Base query: admin sees all, user sees org only (or RLS will enforce anyway)
  const base = supabase
    .from("form_safe")
    .select("id, created_at, employee_name, notes, org_id")
    .order("created_at", { ascending: false })
    .limit(20);

  // For non-admin, restrict to org_id to reduce rows (RLS should still protect)
  const qBase = (profile?.role === "admin" || !profile?.org_id)
    ? base
    : base.eq("org_id", profile.org_id);

  // Try NEW columns first
  let q = qBase.select("id, created_at, employee_name, notes, org_id, form_date, form_time", { head: false });
  let res = await q;

  // If form_date doesn't exist, retry OLD columns
  if (res.error && String(res.error.message || "").includes("form_date")) {
    res = await qBase.select("id, created_at, employee_name, notes, org_id, date, time", { head: false });
  }

  // If date doesn't exist (opposite case), retry NEW columns
  if (res.error && String(res.error.message || "").includes("column") && String(res.error.message || "").includes("date") && !String(res.error.message || "").includes("created_at")) {
    res = await qBase.select("id, created_at, employee_name, notes, org_id, form_date, form_time", { head: false });
  }

  if (res.error) throw res.error;

  // Normalize into a common shape
  const rows = (res.data || []).map(r => ({
    id: r.id,
    created_at: r.created_at,
    type: "Cuadre del Safe",
    form_date: r.form_date ?? r.date ?? null,
    employee_name: r.employee_name ?? "",
    notes: r.notes ?? "",
  }));

  return rows;
}

async function loadRecentEntries(ctx){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;
  try {
    const safeRows = await fetchSafeRecent({ profile: ctx.profile });

    const all = [...safeRows]
      .sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 20);

    if (!all.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = all.map(r => `
      <tr>
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>${esc(r.type)}</td>
        <td>${esc(fmtDateOnly(r.form_date))}</td>
        <td>${esc(r.employee_name)}</td>
        <td>${esc(r.notes)}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err?.message || "Could not load recent entries")}</td></tr>`;
  }
}

// ---------- Boot ----------
(async function boot(){
  try {
    const session = await requireSession();
    if (!session) return;

    const profile = await loadProfile(session.user.id);

    const name = fullName(profile);
    whoamiEl.textContent = `${session.user.email}${name ? " • " + name : ""} • ${String(profile.role || "user").toUpperCase()}`;

    // Admin link visibility
    if (profile.role === "admin") adminLink.style.display = "inline-flex";
    else adminLink.style.display = "none";

    const ctx = { user: session.user, profile };

    // Mount Safe form (others later)
    if (panels.safe) {
      mountSafeForm(panels.safe, ctx);
    }

    // Placeholder for other forms
    if (panels.loteria) panels.loteria.innerHTML = `<div class="muted">Cuadre de Lotería coming next…</div>`;
    if (panels.cashpay) panels.cashpay.innerHTML = `<div class="muted">Cash Payment coming next…</div>`;
    if (panels.transfer) panels.transfer.innerHTML = `<div class="muted">Transfer / Shrinkage coming next…</div>`;
    if (panels.daily) panels.daily.innerHTML = `<div class="muted">Cuadre Diario coming next…</div>`;

    // Default tab
    setActiveTab("safe");

    // Load recent entries
    await loadRecentEntries(ctx);

    // Refresh button
    refreshBtn?.addEventListener("click", () => loadRecentEntries(ctx));

    // When a form saves, refresh recent
    window.addEventListener("forms:saved", () => loadRecentEntries(ctx));

    // Logout
    logoutBtn?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/index.html";
    });

  } catch (err) {
    console.error(err);
    setStatus("err", "❌ " + (err?.message || "Dashboard failed to load"));
  }
})();
