// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));

const whoami = $("whoami");
const adminLink = $("adminLink");
const logoutBtn = $("logoutBtn");
const refreshBtn = $("refreshBtn");
const recentBody = $("recentBody");

const panels = {
  safe: $("panel-safe"),
  loteria: $("panel-loteria"),
  cashpay: $("panel-cashpay"),
  transfer: $("panel-transfer"),
  daily: $("panel-daily"),
};

let ctx = { user: null, profile: null };

function show(el){ el.classList.remove("hide"); }
function hide(el){ el.classList.add("hide"); }

function fmtDateTime(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}
function fmtDate(iso){
  try { return new Date(iso).toLocaleDateString(); } catch { return iso || ""; }
}

async function requireSession(){
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  if (!session?.user){
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfile(userId){
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, org_id, first_name, last_name")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

function setActiveTab(tab){
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tab);
  });

  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    if (k === tab) show(el);
    else hide(el);
  });
}

function mountCurrentTab(tab){
  if (tab === "safe"){
    mountSafeForm(panels.safe, ctx);
    return;
  }
  panels[tab].innerHTML = `<div class="muted">Form coming next…</div>`;
}

async function loadRecentEntries(){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    // IMPORTANT: DB columns are date/time (not form_date/form_time)
    let q = supabase
      .from("form_safe")
      .select("id, created_at, org_id, date, employee_name, notes");

    if (ctx.profile.role !== "admin"){
      q = q.eq("org_id", ctx.profile.org_id);
    }

    const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
    if (error) throw error;

    if (!data || data.length === 0){
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = data.map(r => `
      <tr class="rowLink" data-type="safe" data-id="${esc(r.id)}" style="cursor:pointer">
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>Safe</td>
        <td>${esc(fmtDate(r.date))}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 60))}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    // Click handler (we’ll wire this to a modal next)
    recentBody.querySelectorAll("tr.rowLink").forEach(tr => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        // For now: just scroll to top and highlight the form; next step we’ll open modal view
        window.scrollTo({ top: 0, behavior: "smooth" });
        alert(`Open entry viewer next: ${id}`);
      });
    });

  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(err?.message || "Error loading entries.")}</td></tr>`;
  }
}

async function init(){
  try {
    whoami.textContent = "Loading…";

    const session = await requireSession();
    if (!session) return;

    ctx.user = session.user;
    ctx.profile = await loadProfile(session.user.id);

    const fullName = [ctx.profile.first_name, ctx.profile.last_name].filter(Boolean).join(" ").trim();
    whoami.textContent = `${ctx.user.email} • ${fullName ? fullName + " • " : ""}${String(ctx.profile.role || "user").toUpperCase()}`;

    adminLink.style.display = (ctx.profile.role === "admin") ? "" : "none";

    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        setActiveTab(tab);
        mountCurrentTab(tab);
      });
    });

    setActiveTab("safe");
    mountCurrentTab("safe");

    refreshBtn.addEventListener("click", loadRecentEntries);
    window.addEventListener("forms:saved", loadRecentEntries);

    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/index.html";
    });

    await loadRecentEntries();
  } catch (err) {
    console.error(err);
    whoami.textContent = "Error";
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(err?.message || "Dashboard init failed")}</td></tr>`;
  }
}

init();
