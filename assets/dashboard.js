// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// ---------- DOM ----------
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

// ---------- helpers ----------
function show(el) { el.classList.remove("hide"); }
function hide(el) { el.classList.add("hide"); }

function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso || ""; }
}
function fullNameFromProfile(p){
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
}
function renderWhoAmI(){
  const name = fullNameFromProfile(ctx.profile);
  whoami.textContent =
    `${ctx.user.email} • ${name ? name + " • " : ""}${String(ctx.profile.role || "user").toUpperCase()}`;
}

// ---------- session/profile ----------
async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  if (!session?.user) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, org_id, first_name, last_name")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ---------- tabs ----------
function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tab);
  });

  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    if (k === tab) show(el);
    else hide(el);
  });
}

function mountCurrentTab(tab) {
  if (tab === "safe") {
    mountSafeForm(panels.safe, ctx);
    return;
  }
  panels[tab].innerHTML = `<div class="muted">Form coming next…</div>`;
}

// ---------- modal shell ----------
function ensureModalShell(){
  if (document.getElementById("entryModalOverlay")) return;

  const style = document.createElement("style");
  style.textContent = `
    .modalOverlay{ position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center; padding:18px; z-index:9999;}
    .modalCard{ width:min(760px, 100%); max-height:92vh; overflow:auto;
      background:rgba(15,17,27,.96); border:1px solid rgba(255,255,255,.10);
      border-radius:16px; box-shadow:0 12px 60px rgba(0,0,0,.55); padding:16px;}
    .modalTop{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;}
    .modalTop h3{ margin:0; font-size:18px;}
    .modalTop .sub{ color:rgba(243,246,255,.70); font-size:12px; margin-top:4px;}
    .modalBtns{ display:flex; gap:10px; align-items:center;}
    .modalGrid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px;}
    @media (max-width: 760px){ .modalGrid2{ grid-template-columns:1fr; } }
    .miniNote{ color:rgba(243,246,255,.70); font-size:12px; margin-top:6px;}
    .modalCard input, .modalCard textarea{
      width:100%; padding:10px 12px; border-radius:12px;
      border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.04);
      color:inherit; outline:none;}
    .modalCard textarea{ min-height:90px; resize:vertical;}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "entryModalOverlay";
  overlay.className = "modalOverlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="modalCard" role="dialog" aria-modal="true">
      <div class="modalTop">
        <div>
          <h3 id="entryModalTitle">Modal</h3>
          <div class="sub" id="entryModalSub"></div>
        </div>
        <div class="modalBtns">
          <button class="btn secondary" id="entryModalClose" type="button">Close</button>
        </div>
      </div>
      <div id="entryModalBody"></div>
      <div id="entryModalStatus" class="status" role="status" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById("entryModalClose").addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(){
  ensureModalShell();
  document.getElementById("entryModalOverlay").style.display = "flex";
}
function closeModal(){
  const overlay = document.getElementById("entryModalOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
  document.getElementById("entryModalBody").innerHTML = "";
  const st = document.getElementById("entryModalStatus");
  st.className = "status";
  st.textContent = "";
}
function setModalStatus(type, msg){
  const st = document.getElementById("entryModalStatus");
  st.className = "status " + type;
  st.textContent = msg;
}

// ---------- Profile modal ----------
async function openProfileModal(){
  openModal();
  document.getElementById("entryModalTitle").textContent = "Profile";
  document.getElementById("entryModalSub").textContent = ctx?.user?.email || "";
  setModalStatus("", "");

  const body = document.getElementById("entryModalBody");

  const first = ctx?.profile?.first_name || "";
  const last  = ctx?.profile?.last_name || "";

  body.innerHTML = `
    <div class="modalGrid2">
      <div>
        <label>First Name</label>
        <input id="p_first" type="text" value="${esc(first)}" />
      </div>
      <div>
        <label>Last Name</label>
        <input id="p_last" type="text" value="${esc(last)}" />
      </div>
    </div>

    <div class="miniNote">This updates your display name on the dashboard.</div>

    <div class="actions" style="margin-top:12px; justify-content:flex-end;">
      <button class="btn" id="p_save" type="button">Save</button>
      <button class="btn secondary" id="p_close" type="button">Close</button>
    </div>
  `;

  body.querySelector("#p_close").addEventListener("click", closeModal);

  body.querySelector("#p_save").addEventListener("click", async () => {
    try{
      setModalStatus("ok", "Saving…");

      const first_name = (body.querySelector("#p_first")?.value || "").trim();
      const last_name  = (body.querySelector("#p_last")?.value || "").trim();

      const { error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", ctx.user.id);

      if (error) throw error;

      ctx.profile.first_name = first_name;
      ctx.profile.last_name = last_name;
      renderWhoAmI();

      setModalStatus("ok", "✅ Profile saved.");
      setTimeout(() => closeModal(), 200);
    } catch(err){
      console.error(err);
      setModalStatus("err", "❌ Save failed: " + (err?.message || "Check RLS policy."));
    }
  });
}

// ---------- recent entries ----------
async function loadRecentEntries() {
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    let q = supabase
      .from("form_safe")
      .select("id, created_at, org_id, date, employee_name, notes");

    if (ctx.profile.role !== "admin") {
      q = q.eq("org_id", ctx.profile.org_id);
    }

    const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
    if (error) throw error;

    if (!data || data.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = data
      .map(
        (r) => `
      <tr style="cursor:pointer" data-type="safe" data-id="${esc(r.id)}">
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>Safe</td>
        <td>${esc(fmtDate(r.date))}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 60))}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `
      )
      .join("");

    recentBody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        // (your safe entry viewer/edit modal is elsewhere in your code)
        // keep as-is in your project
        console.log("Clicked entry:", tr.getAttribute("data-id"));
      });
    });
  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(err?.message || "Error loading entries.")}</td></tr>`;
  }
}

// ✅ IMPORTANT: this catches clicks even if button id changes / gets replaced
function wireProfileClickDelegation(){
  document.addEventListener("click", (e) => {
    const hit = e.target.closest("#profileBtn, #profileLink, [data-action='profile']");
    if (!hit) return;
    e.preventDefault();
    openProfileModal();
  });
}

// ---------- init ----------
async function init() {
  try {
    whoami.textContent = "Loading…";

    const session = await requireSession();
    if (!session) return;

    ctx.user = session.user;
    ctx.profile = await loadProfile(session.user.id);

    renderWhoAmI();
    adminLink.style.display = ctx.profile.role === "admin" ? "" : "none";

    // tabs
    document.querySelectorAll(".tab").forEach((btn) => {
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

    wireProfileClickDelegation();

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
