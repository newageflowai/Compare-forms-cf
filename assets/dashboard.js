// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

const $ = (id) => document.getElementById(id);

const whoami = $("whoami");
const pageError = $("pageError");
const adminLink = $("adminLink");
const logoutBtn = $("logoutBtn");

const refreshBtn = $("refreshBtn");
const recentBody = $("recentBody");

// Panels
const panels = {
  safe: $("panel-safe"),
  loteria: $("panel-loteria"),
  cashpay: $("panel-cashpay"),
  transfer: $("panel-transfer"),
  daily: $("panel-daily"),
};

// Modal
const entryOverlay = $("entryOverlay");
const closeEntryBtn = $("closeEntryBtn");
const entryTitle = $("entryTitle");
const entrySubtitle = $("entrySubtitle");
const entryStatus = $("entryStatus");
const entryBody = $("entryBody");
const saveEntryBtn = $("saveEntryBtn");
const saveCloseEntryBtn = $("saveCloseEntryBtn");

function showErr(msg){
  if (pageError){
    pageError.style.display = "block";
    pageError.textContent = msg;
  }
  if (whoami) whoami.textContent = "Error";
}

function show(el){ el.classList.remove("hide"); }
function hide(el){ el.classList.add("hide"); }

function setStatus(el, type, msg){
  el.className = "status " + type; // ok | err
  el.textContent = msg;
}
function clearStatus(el){
  el.className = "status";
  el.textContent = "";
}
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function fmtDateTime(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}
function fmtDate(isoDate){
  try { return new Date(isoDate).toLocaleDateString(); } catch { return isoDate || ""; }
}
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function toCents(v){
  const x = Number(String(v || "").replace(/[$,]/g,""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}
function int0(v){
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

// App state
let ctx = {
  user: null,
  profile: null, // { id, org_id, role, first_name, last_name }
};

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
    const active = b.getAttribute("data-tab") === tab;
    b.classList.toggle("active", active);
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
    let query = supabase
      .from("form_safe")
      .select("id, created_at, org_id, form_date, employee_name, notes");

    if (ctx.profile.role !== "admin"){
      query = query.eq("org_id", ctx.profile.org_id);
    }

    // IMPORTANT: order() must be chained on the query builder, not on supabase itself
    query = query.order("created_at", { ascending: false }).limit(25);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0){
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = data.map(r => `
      <tr class="clickRow" data-type="safe" data-id="${esc(r.id)}" title="Click to view">
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>Safe</td>
        <td>${esc(fmtDate(r.form_date))}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 60))}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    recentBody.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", async () => {
        const id = tr.getAttribute("data-id");
        const type = tr.getAttribute("data-type");
        await openEntryModal(type, id);
      });
    });

  } catch (err) {
    console.error("Recent entries error:", err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(err?.message || "Error loading entries.")}</td></tr>`;
  }
}

// ===== Modal open/view/edit =====
function openOverlay(){
  show(entryOverlay);
  entryOverlay.setAttribute("aria-hidden", "false");
}
function closeOverlay(){
  hide(entryOverlay);
  entryOverlay.setAttribute("aria-hidden", "true");
  entryBody.innerHTML = "";
  clearStatus(entryStatus);
  saveEntryBtn.onclick = null;
  saveCloseEntryBtn.onclick = null;
  hide(saveEntryBtn);
  hide(saveCloseEntryBtn);
}

closeEntryBtn?.addEventListener("click", closeOverlay);
entryOverlay?.addEventListener("click", (e) => { if (e.target === entryOverlay) closeOverlay(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && entryOverlay && !entryOverlay.classList.contains("hide")) closeOverlay(); });

async function openEntryModal(type, id){
  clearStatus(entryStatus);
  entryBody.innerHTML = `<div class="muted">Loading…</div>`;
  openOverlay();

  if (type !== "safe"){
    entryTitle.textContent = "Entry";
    entrySubtitle.textContent = "Unsupported type yet.";
    entryBody.innerHTML = `<div class="muted">Only Safe entries implemented right now.</div>`;
    return;
  }

  entryTitle.textContent = "Cuadre del Safe";
  entrySubtitle.textContent = `ID: ${id}`;

  const { data, error } = await supabase
    .from("form_safe")
    .select("*")
    .eq("id", id)
    .single();

  if (error){
    setStatus(entryStatus, "err", "❌ " + error.message);
    entryBody.innerHTML = "";
    return;
  }

  const isAdmin = ctx.profile.role === "admin";
  entryBody.innerHTML = renderSafeEntryEditor(data, isAdmin);

  if (!isAdmin){
    hide(saveEntryBtn);
    hide(saveCloseEntryBtn);
    return;
  }

  show(saveEntryBtn);
  show(saveCloseEntryBtn);

  saveEntryBtn.onclick = async () => { await saveSafeEntry(id, false); };
  saveCloseEntryBtn.onclick = async () => { await saveSafeEntry(id, true); };
}

function renderSafeEntryEditor(row, editable){
  const dis = editable ? "" : "disabled";

  const qtyRow = (label, key, unitCents) => {
    const qty = Number(row[key] ?? 0);
    const amt = qty * unitCents;
    return `
      <tr>
        <td>${esc(label)}</td>
        <td><input ${dis} type="number" min="0" step="1" id="m_${esc(key)}" value="${esc(qty)}" /></td>
        <td class="mono">${esc(money(amt))}</td>
      </tr>
    `;
  };

  const bills =
    qtyRow("$100", "bills_100_qty", 10000) +
    qtyRow("$50",  "bills_50_qty",  5000) +
    qtyRow("$20",  "bills_20_qty",  2000) +
    qtyRow("$10",  "bills_10_qty",  1000) +
    qtyRow("$5",   "bills_5_qty",   500) +
    qtyRow("$1",   "bills_1_qty",   100);

  const coins =
    qtyRow("Quarters", "quarters_qty", 25) +
    qtyRow("Dimes",    "dimes_qty",    10) +
    qtyRow("Nickels",  "nickels_qty",  5) +
    qtyRow("Pennies",  "pennies_qty",  1);

  const reg1 = (Number(row.reg1_amount_cents ?? 0) / 100).toFixed(2);
  const reg2 = (Number(row.reg2_amount_cents ?? 0) / 100).toFixed(2);

  return `
    <div class="grid2">
      <div>
        <label>Date</label>
        <input ${dis} type="date" id="m_form_date" value="${esc(row.form_date || "")}" />
      </div>
      <div>
        <label>Time</label>
        <input ${dis} type="time" id="m_form_time" value="${esc(row.form_time || "")}" />
      </div>
    </div>

    <div style="margin-top:10px">
      <label>Employee Name</label>
      <input ${dis} type="text" id="m_employee_name" value="${esc(row.employee_name || "")}" />
    </div>

    <div class="sectionTitle" style="margin-top:12px">Bills</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Denomination</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>${bills}</tbody>
      </table>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Registers</div>
    <div class="grid2">
      <div>
        <label>Register 1 Amount</label>
        <input ${dis} type="text" id="m_reg1" value="${esc(reg1)}" />
      </div>
      <div>
        <label>Register 2 Amount</label>
        <input ${dis} type="text" id="m_reg2" value="${esc(reg2)}" />
      </div>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Coins</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Coin</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>${coins}</tbody>
      </table>
    </div>

    <div style="margin-top:10px">
      <label>Notes</label>
      <textarea ${dis} id="m_notes" placeholder="Notes…">${esc(row.notes || "")}</textarea>
    </div>

    <div class="muted" style="margin-top:10px">
      Created: <span class="mono">${esc(fmtDateTime(row.created_at))}</span>
    </div>
  `;
}

async function saveSafeEntry(id, closeAfter){
  clearStatus(entryStatus);

  try {
    setStatus(entryStatus, "ok", "Saving…");

    const patch = {
      form_date: $("m_form_date").value || null,
      form_time: $("m_form_time").value || null,
      employee_name: $("m_employee_name").value.trim(),
      reg1_amount_cents: toCents($("m_reg1").value),
      reg2_amount_cents: toCents($("m_reg2").value),
      notes: $("m_notes").value.trim() || null,

      bills_100_qty: int0($("m_bills_100_qty").value),
      bills_50_qty:  int0($("m_bills_50_qty").value),
      bills_20_qty:  int0($("m_bills_20_qty").value),
      bills_10_qty:  int0($("m_bills_10_qty").value),
      bills_5_qty:   int0($("m_bills_5_qty").value),
      bills_1_qty:   int0($("m_bills_1_qty").value),

      quarters_qty: int0($("m_quarters_qty").value),
      dimes_qty:    int0($("m_dimes_qty").value),
      nickels_qty:  int0($("m_nickels_qty").value),
      pennies_qty:  int0($("m_pennies_qty").value),
    };

    const { error } = await supabase
      .from("form_safe")
      .update(patch)
      .eq("id", id);

    if (error) throw error;

    setStatus(entryStatus, "ok", "✅ Saved.");
    await loadRecentEntries();

    if (closeAfter) closeOverlay();
  } catch (err) {
    console.error(err);
    setStatus(entryStatus, "err", "❌ " + (err?.message || "Save failed"));
  }
}

// ===== Startup =====
async function init(){
  try {
    whoami.textContent = "Loading…";

    const session = await requireSession();
    if (!session) return;

    ctx.user = session.user;

    const profile = await loadProfile(session.user.id);
    ctx.profile = profile;

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    whoami.textContent = `${ctx.user.email} • ${fullName ? fullName + " • " : ""}${String(profile.role || "user").toUpperCase()}`;

    if (profile.role === "admin"){
      adminLink.style.display = "";
    } else {
      adminLink.style.display = "none";
    }

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
    console.error("Dashboard init error:", err);
    showErr("Dashboard init error:\n" + (err?.message || String(err)));
  }
}

init();
