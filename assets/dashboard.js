// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const recentBody = document.getElementById("recentBody");
const refreshBtn = document.getElementById("refreshBtn");
const formStatus = document.getElementById("formStatus");

const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

function setStatus(type, msg){
  formStatus.className = "status " + type; // ok | err
  formStatus.textContent = msg;
}
function clearStatus(){
  formStatus.className = "status";
  formStatus.textContent = "";
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDate(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

let ctx = { user:null, profile:null };

async function requireSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfile(userId){
  // Expect profiles table: id (uuid), email, role, org_id, is_active
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, org_id, is_active")
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

function showTab(tab){
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hide"));

  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add("active");

  const panel = panels[tab];
  if (panel) panel.classList.remove("hide");

  clearStatus();
}

async function loadRecentSafe(){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  // Admin sees all, user sees org only
  let q = supabase
    .from("form_safe")
    .select("id, created_at, date, employee_name, notes, org_id")
    .order("created_at", { ascending:false })
    .limit(25);

  if (ctx.profile?.role !== "admin") {
    q = q.eq("org_id", ctx.profile?.org_id);
  }

  const { data, error } = await q;
  if (error) {
    console.error(error);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
    return;
  }

  recentBody.innerHTML = data.map(r => `
    <tr>
      <td>${fmtDate(r.created_at)}</td>
      <td>Safe</td>
      <td>${esc(r.date || "")}</td>
      <td>${esc(r.employee_name || "")}</td>
      <td>${esc(r.notes || "")}</td>
      <td class="mono">${esc(r.id)}</td>
    </tr>
  `).join("");
}

async function init(){
  const session = await requireSession();
  if (!session) return;

  ctx.user = session.user;

  try {
    ctx.profile = await loadProfile(session.user.id);
  } catch (e) {
    console.error(e);
    whoami.textContent = "Error loading profile";
    setStatus("err", "❌ " + (e?.message || "Profile load failed"));
    return;
  }

  const email = session.user.email || ctx.profile.email || "(no email)";
  const role = String(ctx.profile.role || "user").toUpperCase();
  whoami.textContent = `${email} • ${role}`;

  // Admin link visible only for admins
  adminLink.style.display = (ctx.profile.role === "admin") ? "inline-block" : "none";

  // Mount SAFE form
  mountSafeForm(panels.safe, ctx);

  // TODO later: mount other forms here
  panels.loteria.innerHTML = `<div class="muted">Next: Cuadre de Lotería</div>`;
  panels.cashpay.innerHTML = `<div class="muted">Next: Cash Payment</div>`;
  panels.transfer.innerHTML = `<div class="muted">Next: Transfer / Shrinkage</div>`;
  panels.daily.innerHTML = `<div class="muted">Next: Cuadre Diario</div>`;

  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  // Recent
  await loadRecentSafe();

  refreshBtn.addEventListener("click", loadRecentSafe);
  window.addEventListener("forms:saved", () => loadRecentSafe());

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });

  showTab("safe");
}

init();
