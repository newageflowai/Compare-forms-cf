// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

// ---------- helpers ----------
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDateTime(ts){ try { return new Date(ts).toLocaleString(); } catch { return String(ts || ""); } }
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function n0(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function int0(v){ return Math.max(0, Math.trunc(n0(v))); }
function toCents(v){
  const x = n0(String(v).replace(/[$,]/g,""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

const DENOMS = {
  bills: [
    { key: "bills_100_qty", label: "$100", cents: 10000 },
    { key: "bills_50_qty",  label: "$50",  cents: 5000 },
    { key: "bills_20_qty",  label: "$20",  cents: 2000 },
    { key: "bills_10_qty",  label: "$10",  cents: 1000 },
    { key: "bills_5_qty",   label: "$5",   cents: 500 },
    { key: "bills_1_qty",   label: "$1",   cents: 100 },
  ],
  coins: [
    { key: "quarters_qty", label: "Quarters", cents: 25 },
    { key: "dimes_qty",    label: "Dimes",    cents: 10 },
    { key: "nickels_qty",  label: "Nickels",  cents: 5 },
    { key: "pennies_qty",  label: "Pennies",  cents: 1 },
  ]
};

// ---------- DOM ----------
const whoamiEl = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const formStatus = document.getElementById("formStatus");
const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");

const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));

// Modal elements
const entryOverlay = document.getElementById("entryOverlay");
const entryTitle = document.getElementById("entryTitle");
const entryMeta = document.getElementById("entryMeta");
const entryBody = document.getElementById("entryBody");
const entryStatus = document.getElementById("entryStatus");
const entryCloseBtn = document.getElementById("entryCloseBtn");
const entryEditBtn = document.getElementById("entryEditBtn");
const entrySaveBtn = document.getElementById("entrySaveBtn");
const entryModeBadge = document.getElementById("entryModeBadge");

function setStatus(type, msg){
  if (!formStatus) return;
  formStatus.className = "status " + type;
  formStatus.textContent = msg;
}
function clearStatus(){
  if (!formStatus) return;
  formStatus.className = "status";
  formStatus.textContent = "";
}

function setModalStatus(type, msg){
  entryStatus.className = "status " + type;
  entryStatus.textContent = msg;
}
function clearModalStatus(){
  entryStatus.className = "status";
  entryStatus.textContent = "";
}

function show(el){ el.classList.remove("hide"); el.setAttribute("aria-hidden","false"); }
function hide(el){ el.classList.add("hide"); el.setAttribute("aria-hidden","true"); }

// ---------- tabs ----------
function setActiveTab(key){
  tabButtons.forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-tab") === key));
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hide", k !== key);
  });
}
tabButtons.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab"))));

// ---------- auth/profile ----------
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
    .select("id, email, role, org_id, first_name, last_name")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

function fullName(p){
  const first = String(p?.first_name || "").trim();
  const last  = String(p?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || "";
}

// ---------- recent entries ----------
async function fetchSafeRecent({ profile }){
  // Try NEW columns first: form_date/form_time; fallback to date/time
  const base = supabase
    .from("form_safe")
    .order("created_at", { ascending:false })
    .limit(20);

  const qBase = (profile?.role === "admin" || !profile?.org_id)
    ? base
    : base.eq("org_id", profile.org_id);

  let res = await qBase.select("id, created_at, employee_name, notes, org_id, form_date, form_time");

  if (res.error && String(res.error.message || "").includes("form_date")) {
    res = await qBase.select("id, created_at, employee_name, notes, org_id, date, time");
  }

  if (res.error) throw res.error;

  return (res.data || []).map(r => ({
    id: r.id,
    created_at: r.created_at,
    type: "safe",
    typeLabel: "Cuadre del Safe",
    form_date: r.form_date ?? r.date ?? null,
    employee_name: r.employee_name ?? "",
    notes: r.notes ?? "",
  }));
}

async function loadRecentEntries(ctx){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;
  try {
    const safeRows = await fetchSafeRecent({ profile: ctx.profile });

    if (!safeRows.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = safeRows.map(r => `
      <tr class="clickRow" data-type="${esc(r.type)}" data-id="${esc(r.id)}">
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>${esc(r.typeLabel)}</td>
        <td>${esc(String(r.form_date || ""))}</td>
        <td>${esc(r.employee_name)}</td>
        <td>${esc(r.notes)}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    // click to open modal
    recentBody.querySelectorAll("tr[data-id][data-type]").forEach(tr => {
      tr.addEventListener("click", async () => {
        const id = tr.getAttribute("data-id");
        const type = tr.getAttribute("data-type");
        await openEntryModal({ id, type, ctx });
      });
    });

  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err?.message || "Could not load recent entries")}</td></tr>`;
  }
}

// ---------- modal: view/edit SAFE ----------
let modalState = {
  type: null,
  id: null,
  isAdmin: false,
  editMode: false,
  // schema detection
  dateCol: "form_date",
  timeCol: "form_time",
  // loaded row
  row: null,
};

function setEditMode(on){
  modalState.editMode = !!on;

  if (modalState.isAdmin) {
    entryEditBtn.style.display = on ? "none" : "inline-flex";
    entrySaveBtn.style.display = on ? "inline-flex" : "none";
    entryModeBadge.textContent = on ? "EDIT MODE" : "VIEW ONLY";
  } else {
    entryEditBtn.style.display = "none";
    entrySaveBtn.style.display = "none";
    entryModeBadge.textContent = "VIEW ONLY";
  }

  // toggle disabled state for inputs in body
  entryBody.querySelectorAll("[data-editable='1']").forEach(el => {
    el.disabled = !on;
    el.readOnly = !on;
  });
}

function calcSafeFromRow(r){
  let bills = 0;
  for (const b of DENOMS.bills) bills += (int0(r[b.key]) * b.cents);
  const regs = (int0(r.reg1_amount_cents) + int0(r.reg2_amount_cents));
  let coins = 0;
  for (const c of DENOMS.coins) coins += (int0(r[c.key]) * c.cents);
  return { bills, regs, coins, total: bills + regs + coins };
}

function renderSafeModalBody(r){
  const dateVal = r.form_date ?? r.date ?? "";
  const timeVal = r.form_time ?? r.time ?? "";

  const computed = calcSafeFromRow(r);

  function qtyRow(label, qty, amount){
    return `
      <tr>
        <td>${esc(label)}</td>
        <td>${esc(String(qty ?? 0))}</td>
        <td class="mono">${esc(money(amount))}</td>
      </tr>
    `;
  }

  const billsRows = DENOMS.bills.map(b => {
    const qty = int0(r[b.key]);
    return qtyRow(b.label, qty, qty * b.cents);
  }).join("");

  const coinsRows = DENOMS.coins.map(c => {
    const qty = int0(r[c.key]);
    return qtyRow(c.label, qty, qty * c.cents);
  }).join("");

  return `
    <div class="modalGrid">
      <div>
        <label>Date</label>
        <input id="m_safe_date" data-editable="1" type="date" value="${esc(String(dateVal))}" disabled />
      </div>
      <div>
        <label>Time</label>
        <input id="m_safe_time" data-editable="1" type="time" value="${esc(String(timeVal || ""))}" disabled />
      </div>
    </div>

    <div style="margin-top:10px">
      <label>Employee Name</label>
      <input id="m_safe_employee" data-editable="1" type="text" value="${esc(r.employee_name || "")}" disabled />
    </div>

    <div class="sectionTitle" style="margin-top:14px">Bills</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Denomination</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>${billsRows}</tbody>
        <tfoot>
          <tr>
            <th colspan="2" style="text-align:right">Bills Subtotal</th>
            <th class="mono">${money(computed.bills)}</th>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="sectionTitle" style="margin-top:14px">Registers</div>
    <div class="modalGrid">
      <div>
        <label>Register 1 Amount</label>
        <input id="m_safe_reg1" data-editable="1" type="text" value="${esc(money(int0(r.reg1_amount_cents)).replace("$",""))}" disabled />
      </div>
      <div>
        <label>Register 2 Amount</label>
        <input id="m_safe_reg2" data-editable="1" type="text" value="${esc(money(int0(r.reg2_amount_cents)).replace("$",""))}" disabled />
      </div>
    </div>
    <div class="totalsRow" style="margin-top:8px">
      <div class="muted">Registers Subtotal</div>
      <div class="mono">${money(computed.regs)}</div>
    </div>

    <div class="sectionTitle" style="margin-top:14px">Coins</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Coin</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>${coinsRows}</tbody>
        <tfoot>
          <tr>
            <th colspan="2" style="text-align:right">Coins Subtotal</th>
            <th class="mono">${money(computed.coins)}</th>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="margin-top:10px">
      <label>Notes</label>
      <textarea id="m_safe_notes" data-editable="1" disabled>${esc(r.notes || "")}</textarea>
    </div>

    <div class="totalsRow" style="margin-top:12px">
      <div style="font-weight:800">TOTAL</div>
      <div class="mono" style="font-weight:900">${money(computed.total)}</div>
    </div>
  `;
}

async function detectSafeSchema(){
  // We detect if form_date exists by attempting a select that includes it
  const probe = await supabase.from("form_safe").select("id, form_date").limit(1);
  if (!probe.error) {
    return { dateCol: "form_date", timeCol: "form_time" };
  }
  // fallback to old names
  return { dateCol: "date", timeCol: "time" };
}

async function loadSafeEntryById(id){
  // first try new columns; fallback automatically
  let res = await supabase
    .from("form_safe")
    .select("*")
    .eq("id", id)
    .single();

  if (res.error) throw res.error;
  return res.data;
}

async function openEntryModal({ id, type, ctx }){
  clearModalStatus();
  modalState = {
    type,
    id,
    isAdmin: ctx?.profile?.role === "admin",
    editMode: false,
    dateCol: "form_date",
    timeCol: "form_time",
    row: null,
  };

  // header
  entryTitle.textContent = type === "safe" ? "Cuadre del Safe" : "Entry";
  entryMeta.textContent = `Loading…`;
  entryBody.innerHTML = `<div class="muted">Loading…</div>`;

  // buttons
  entryEditBtn.style.display = "none";
  entrySaveBtn.style.display = "none";
  entryModeBadge.textContent = "VIEW ONLY";

  show(entryOverlay);

  try {
    const schema = await detectSafeSchema();
    modalState.dateCol = schema.dateCol;
    modalState.timeCol = schema.timeCol;

    const row = await loadSafeEntryById(id);
    modalState.row = row;

    entryMeta.textContent =
      `Created: ${fmtDateTime(row.created_at)} • ID: ${row.id}`;

    if (type === "safe") {
      entryBody.innerHTML = renderSafeModalBody(row);
    } else {
      entryBody.innerHTML = `<div class="muted">Unsupported entry type.</div>`;
    }

    // admin can edit
    if (modalState.isAdmin) {
      entryEditBtn.style.display = "inline-flex";
      entryModeBadge.textContent = "VIEW ONLY";
    }

    setEditMode(false);

  } catch (err) {
    console.error(err);
    setModalStatus("err", "❌ Could not load entry: " + (err?.message || "Unknown error"));
  }
}

async function saveSafeEdits(ctx){
  clearModalStatus();
  if (!modalState.isAdmin) return setModalStatus("err", "❌ Admin only.");
  if (!modalState.row?.id) return setModalStatus("err", "❌ No entry loaded.");

  // collect editable fields
  const dateEl = document.getElementById("m_safe_date");
  const timeEl = document.getElementById("m_safe_time");
  const empEl  = document.getElementById("m_safe_employee");
  const reg1El = document.getElementById("m_safe_reg1");
  const reg2El = document.getElementById("m_safe_reg2");
  const notesEl = document.getElementById("m_safe_notes");

  const form_date = (dateEl?.value || "").trim();
  const form_time = (timeEl?.value || "").trim();
  const employee_name = (empEl?.value || "").trim();
  const reg1_amount_cents = toCents(reg1El?.value || "0");
  const reg2_amount_cents = toCents(reg2El?.value || "0");
  const notes = (notesEl?.value || "").trim();

  if (!form_date) return setModalStatus("err", "❌ Date is required.");
  if (!employee_name) return setModalStatus("err", "❌ Employee name is required.");

  // write to whichever columns exist
  const patch = {
    employee_name,
    reg1_amount_cents,
    reg2_amount_cents,
    notes: notes || null,
  };
  patch[modalState.dateCol] = form_date;
  patch[modalState.timeCol] = form_time || null;

  try {
    entrySaveBtn.disabled = true;
    setModalStatus("ok", "Saving…");

    const { error } = await supabase
      .from("form_safe")
      .update(patch)
      .eq("id", modalState.row.id);

    if (error) throw error;

    setModalStatus("ok", "✅ Saved.");
    setEditMode(false);

    // refresh recent list so changes show
    window.dispatchEvent(new CustomEvent("forms:saved", { detail: { type:"safe", id: modalState.row.id } }));

  } catch (err) {
    console.error(err);
    setModalStatus("err", "❌ Save failed: " + (err?.message || "Check RLS."));
  } finally {
    entrySaveBtn.disabled = false;
  }
}

// modal close behavior
entryCloseBtn?.addEventListener("click", () => hide(entryOverlay));
entryOverlay?.addEventListener("click", (e) => { if (e.target === entryOverlay) hide(entryOverlay); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !entryOverlay.classList.contains("hide")) hide(entryOverlay); });

entryEditBtn?.addEventListener("click", () => setEditMode(true));
entrySaveBtn?.addEventListener("click", async () => {
  // ctx is stored in closure via boot() below (we call saveSafeEdits with it)
});

// ---------- boot ----------
(async function boot(){
  try {
    const session = await requireSession();
    if (!session) return;

    const profile = await loadProfile(session.user.id);

    const name = fullName(profile);
    whoamiEl.textContent = `${session.user.email}${name ? " • " + name : ""} • ${String(profile.role || "user").toUpperCase()}`;

    if (profile.role === "admin") adminLink.style.display = "inline-flex";
    else adminLink.style.display = "none";

    const ctx = { user: session.user, profile };

    // wire save btn with ctx
    entrySaveBtn?.addEventListener("click", () => saveSafeEdits(ctx));

    // mount forms
    if (panels.safe) mountSafeForm(panels.safe, ctx);
    if (panels.loteria) panels.loteria.innerHTML = `<div class="muted">Cuadre de Lotería coming next…</div>`;
    if (panels.cashpay) panels.cashpay.innerHTML = `<div class="muted">Cash Payment coming next…</div>`;
    if (panels.transfer) panels.transfer.innerHTML = `<div class="muted">Transfer / Shrinkage coming next…</div>`;
    if (panels.daily) panels.daily.innerHTML = `<div class="muted">Cuadre Diario coming next…</div>`;

    setActiveTab("safe");

    await loadRecentEntries(ctx);

    refreshBtn?.addEventListener("click", () => loadRecentEntries(ctx));
    window.addEventListener("forms:saved", () => loadRecentEntries(ctx));

    logoutBtn?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/index.html";
    });

  } catch (err) {
    console.error(err);
    setStatus("err", "❌ " + (err?.message || "Dashboard failed to load"));
  }
})();
