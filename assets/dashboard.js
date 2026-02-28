// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js"; // <-- MUST match: /public/assets/forms/safe.js

const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const profileLink = document.getElementById("profileLink");

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

const recentBody = document.getElementById("recentBody");
const refreshBtn = document.getElementById("refreshBtn");

let ctx = { user: null, profile: null };

// ---- small helpers
function show(el){ if (el) el.style.display = ""; }
function hide(el){ if (el) el.style.display = "none"; }
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function fmtTs(ts){
  try { return new Date(ts).toLocaleString(); } catch { return String(ts || ""); }
}

async function requireSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfile(userId){
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, org_id, first_name, last_name, is_active")
    .eq("id", userId)
    .single();

  if (error) throw error;

  if (data?.is_active === false) {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
    return null;
  }
  return data;
}

function setWhoAmI(){
  const email = ctx?.user?.email || "";
  const first = (ctx?.profile?.first_name || "").trim();
  const last  = (ctx?.profile?.last_name || "").trim();
  const name  = `${first} ${last}`.trim();
  const role  = (ctx?.profile?.role || "user").toUpperCase();
  whoami.textContent = `${email}${name ? " • " + name : ""} • ${role}`;
}

function setTopButtons(){
  // show Profile link when logged in
  if (profileLink) show(profileLink);

  // admin link only for admin
  if ((ctx?.profile?.role || "") === "admin") show(adminLink);
  else hide(adminLink);
}

// ---- TAB switching
function selectTab(key){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));

  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    if (k === key) el.classList.remove("hide");
    else el.classList.add("hide");
  });

  // IMPORTANT: mount Safe form when safe tab is selected
  if (key === "safe") {
    mountSafe();
  } else {
    mountPlaceholder(key);
  }
}

// ---- Mount safe form (always re-mount cleanly)
function mountSafe(){
  const panel = panels.safe;
  if (!panel) return;

  // wipe panel and mount fresh
  panel.innerHTML = "";
  mountSafeForm(panel, ctx);
}

// ---- Placeholder panels (for now)
function mountPlaceholder(key){
  const panel = panels[key];
  if (!panel) return;

  if (key === "loteria") panel.innerHTML = `<div class="muted">Lotería form coming next…</div>`;
  if (key === "cashpay") panel.innerHTML = `<div class="muted">Cash Payment form coming next…</div>`;
  if (key === "transfer") panel.innerHTML = `<div class="muted">Transfer / Shrinkage form coming next…</div>`;
  if (key === "daily") panel.innerHTML = `<div class="muted">Cuadre Diario form coming next…</div>`;
}

// ---- Recent Entries
async function loadRecent(){
  if (!ctx?.profile) return;

  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  let q = supabase
    .from("form_safe")
    .select("id, created_at, form_date, employee_name, notes")
    .order("created_at", { ascending: false })
    .limit(25);

  if ((ctx.profile.role || "") !== "admin") {
    q = q.eq("org_id", ctx.profile.org_id);
  }

  const { data, error } = await q;

  if (error) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
    return;
  }

  recentBody.innerHTML = data.map(r => `
    <tr>
      <td>${esc(fmtTs(r.created_at))}</td>
      <td>Safe</td>
      <td>${esc(r.form_date || "")}</td>
      <td>${esc(r.employee_name || "")}</td>
      <td>${esc(r.notes || "")}</td>
      <td class="mono">${esc(r.id)}</td>
    </tr>
  `).join("");
}

// ---- Events
logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
});

tabs.forEach(t => {
  t.addEventListener("click", () => selectTab(t.dataset.tab));
});

refreshBtn?.addEventListener("click", loadRecent);

// form save event hook
window.addEventListener("forms:saved", () => loadRecent());

// ---- Init
(async function init(){
  const session = await requireSession();
  if (!session) return;

  ctx.user = session.user;

  try {
    ctx.profile = await loadProfile(session.user.id);
    if (!ctx.profile) return;

    setWhoAmI();
    setTopButtons();

    // Mount safe immediately on load
    selectTab("safe");
    await loadRecent();

  } catch (e) {
    console.error(e);
    whoami.textContent = "Error loading profile";
  }
})();
