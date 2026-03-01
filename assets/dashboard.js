// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDateTime(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}
function fmtDateOnly(d){
  try { return new Date(d).toLocaleDateString(); } catch { return d || ""; }
}
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function int0(v){
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}
function toCents(v){
  const x = Number(String(v ?? "").replace(/[$,]/g,""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

const whoamiEl = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");

let ctx = {
  user: null,
  profile: null, // { org_id, role, first_name, last_name, email }
};

// ========= MODAL (VIEW/EDIT ENTRY) =========
function ensureModal(){
  let overlay = document.getElementById("entryOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "entryOverlay";
  overlay.className = "modalOverlay hide";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="entryTitle">
      <div class="modalHeader">
        <div>
          <h2 id="entryTitle" style="margin:0">Entry</h2>
          <div class="muted" id="entrySubtitle"></div>
        </div>
        <div class="actions">
          <button class="smallBtn" id="entryCloseBtn" type="button">Close</button>
        </div>
      </div>

      <div id="entryStatus" class="status" role="status" aria-live="polite"></div>

      <div id="entryBody"></div>

      <div class="actions" style="margin-top:12px; justify-content:flex-end; gap:10px">
        <button class="btn secondary" id="entryCancelBtn" type="button">Close</button>
        <button class="btn" id="entrySaveBtn" type="button">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeEntryModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hide")) closeEntryModal();
  });

  overlay.querySelector("#entryCloseBtn").addEventListener("click", closeEntryModal);
  overlay.querySelector("#entryCancelBtn").addEventListener("click", closeEntryModal);

  return overlay;
}

let activeEntry = null; // { type, id }

function openEntryModal({ type, id }){
  activeEntry = { type, id };
  const overlay = ensureModal();
  overlay.classList.remove("hide");
  overlay.setAttribute("aria-hidden", "false");
}

function closeEntryModal(){
  const overlay = ensureModal();
  overlay.classList.add("hide");
  overlay.setAttribute("aria-hidden", "true");
  activeEntry = null;
  overlay.querySelector("#entryStatus").className = "status";
  overlay.querySelector("#entryStatus").textContent = "";
  overlay.querySelector("#entryBody").innerHTML = "";
}

function setEntryStatus(kind, msg){
  const overlay = ensureModal();
  const el = overlay.querySelector("#entryStatus");
  el.className = "status " + kind; // ok | err
  el.textContent = msg;
}

function clearEntryStatus(){
  const overlay = ensureModal();
  const el = overlay.querySelector("#entryStatus");
  el.className = "status";
  el.textContent = "";
}

// ========= AUTH / PROFILE =========
async function loadProfile(user){
  // Expecting profiles table with at least: id, email, role, org_id, first_name, last_name
  // If your column names differ, tell me and I’ll adjust.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, org_id, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

async function init(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user){
    window.location.href = "/index.html";
    return;
  }

  ctx.user = session.user;
  ctx.profile = await loadProfile(session.user);

  const fullName = [ctx.profile.first_name, ctx.profile.last_name].filter(Boolean).join(" ").trim();
  const role = (ctx.profile.role || "user").toUpperCase();
  whoamiEl.textContent = `${ctx.user.email}${fullName ? " • " + fullName : ""} • ${role}`;

  if (ctx.profile.role === "admin") adminLink.style.display = "";
  else adminLink.style.display = "none";

  // Mount Safe form into its panel
  mountSafeForm(panels.safe, ctx);

  // Tabs
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.getAttribute("data-tab");
      Object.entries(panels).forEach(([k, el]) => {
        if (!el) return;
        if (k === tab) el.classList.remove("hide");
        else el.classList.add("hide");
      });
    });
  });

  // Recent entries
  refreshBtn.addEventListener("click", loadRecentEntries);
  window.addEventListener("forms:saved", () => loadRecentEntries());

  // logout
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });

  await loadRecentEntries();
}

async function loadRecentEntries(){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    // SAFE entries only for now (we’ll add other forms later)
    let q = supabase
      .from("form_safe")
      .select("id, created_at, org_id, form_date, employee_name, notes")
      .order("created_at", { ascending: false })
      .limit(25);

    if (ctx.profile.role !== "admin"){
      q = q.eq("org_id", ctx.profile.org_id);
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0){
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = data.map(r => `
      <tr class="clickRow" data-type="safe" data-id="${esc(r.id)}" style="cursor:pointer">
        <td>${fmtDateTime(r.created_at)}</td>
        <td>Safe</td>
        <td>${r.form_date ? fmtDateOnly(r.form_date) : ""}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 40))}${(r.notes || "").length > 40 ? "…" : ""}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    recentBody.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", async () => {
        const id = tr.getAttribute("data-id");
        const type = tr.getAttribute("data-type");
        await viewEntry({ type, id });
      });
    });

  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error loading entries.</td></tr>`;
  }
}

// ========= VIEW/EDIT SAFE ENTRY =========
async function viewEntry({ type, id }){
  if (type !== "safe") return;

  openEntryModal({ type, id });

  const overlay = ensureModal();
  overlay.querySelector("#entryTitle").textContent = "Cuadre del Safe";
  overlay.querySelector("#entrySubtitle").textContent = `Entry ID: ${id}`;

  clearEntryStatus();
  overlay.querySelector("#entryBody").innerHTML = `<div class="muted">Loading…</div>`;

  try {
    let q = supabase
      .from("form_safe")
      .select("*")
      .eq("id", id)
      .limit(1)
      .single();

    // RLS should already enforce org access for users
    const { data, error } = await q;
    if (error) throw error;

    renderSafeEntryEditor(data);

  } catch (err) {
    console.error(err);
    overlay.querySelector("#entryBody").innerHTML = `<div class="muted">Could not load entry.</div>`;
    setEntryStatus("err", "❌ " + (err?.message || "Load failed."));
  }
}

function renderSafeEntryEditor(row){
  const overlay = ensureModal();
  const isAdmin = ctx.profile.role === "admin";

  // Build editable inputs (disabled for users)
  const dis = isAdmin ? "" : "disabled";

  // Helper to compute totals from quantities
  const bills =
    int0(row.bills_100_qty)*10000 +
    int0(row.bills_50_qty)*5000 +
    int0(row.bills_20_qty)*2000 +
    int0(row.bills_10_qty)*1000 +
    int0(row.bills_5_qty)*500 +
    int0(row.bills_1_qty)*100;

  const regs = int0(row.reg1_amount_cents) + int0(row.reg2_amount_cents);

  const coins =
    int0(row.quarters_qty)*25 +
    int0(row.dimes_qty)*10 +
    int0(row.nickels_qty)*5 +
    int0(row.pennies_qty)*1;

  const total = bills + regs + coins;

  overlay.querySelector("#entryBody").innerHTML = `
    <div class="grid2">
      <div>
        <label>Date</label>
        <input id="ve_form_date" type="date" value="${row.form_date ?? ""}" ${dis}/>
      </div>
      <div>
        <label>Time</label>
        <input id="ve_form_time" type="text" value="${esc(row.form_time ?? "")}" placeholder="09:58 AM" ${dis}/>
      </div>
    </div>

    <div style="margin-top:10px">
      <label>Employee Name</label>
      <input id="ve_employee_name" type="text" value="${esc(row.employee_name ?? "")}" ${dis}/>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Bills</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Denomination</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          ${billLine("$100","bills_100_qty", row.bills_100_qty, 10000, dis)}
          ${billLine("$50","bills_50_qty", row.bills_50_qty, 5000, dis)}
          ${billLine("$20","bills_20_qty", row.bills_20_qty, 2000, dis)}
          ${billLine("$10","bills_10_qty", row.bills_10_qty, 1000, dis)}
          ${billLine("$5","bills_5_qty", row.bills_5_qty, 500, dis)}
          ${billLine("$1","bills_1_qty", row.bills_1_qty, 100, dis)}
        </tbody>
        <tfoot>
          <tr><th colspan="2" style="text-align:right">Bills Subtotal</th><th class="mono" id="ve_bills_sub">${money(bills)}</th></tr>
        </tfoot>
      </table>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Registers</div>
    <div class="grid2">
      <div>
        <label>Register 1 Amount</label>
        <input id="ve_reg1" type="text" value="${(Number(row.reg1_amount_cents||0)/100).toFixed(2)}" ${dis}/>
      </div>
      <div>
        <label>Register 2 Amount</label>
        <input id="ve_reg2" type="text" value="${(Number(row.reg2_amount_cents||0)/100).toFixed(2)}" ${dis}/>
      </div>
    </div>
    <div class="totalsRow" style="margin-top:8px">
      <div class="muted">Registers Subtotal</div>
      <div class="mono" id="ve_regs_sub">${money(regs)}</div>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Coins</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Coin</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          ${coinLine("Quarters","quarters_qty", row.quarters_qty, 25, dis)}
          ${coinLine("Dimes","dimes_qty", row.dimes_qty, 10, dis)}
          ${coinLine("Nickels","nickels_qty", row.nickels_qty, 5, dis)}
          ${coinLine("Pennies","pennies_qty", row.pennies_qty, 1, dis)}
        </tbody>
        <tfoot>
          <tr><th colspan="2" style="text-align:right">Coins Subtotal</th><th class="mono" id="ve_coins_sub">${money(coins)}</th></tr>
        </tfoot>
      </table>
    </div>

    <div style="margin-top:10px">
      <label>Notes</label>
      <textarea id="ve_notes" ${dis}>${esc(row.notes ?? "")}</textarea>
    </div>

    <div class="totalsRow" style="margin-top:12px">
      <div style="font-weight:800">TOTAL</div>
      <div class="mono" id="ve_total" style="font-weight:900">${money(total)}</div>
    </div>

    ${!isAdmin ? `<div class="muted" style="margin-top:10px">View only. Ask an admin to edit.</div>` : ``}
  `;

  // Show/hide Save button
  const saveBtn = overlay.querySelector("#entrySaveBtn");
  saveBtn.style.display = isAdmin ? "" : "none";

  // Live recalc if admin edits fields
  if (isAdmin){
    overlay.querySelectorAll("#entryBody input, #entryBody textarea").forEach(el => {
      el.addEventListener("input", () => recalcViewEditorTotals());
    });

    saveBtn.onclick = async () => {
      clearEntryStatus();
      saveBtn.disabled = true;
      setEntryStatus("ok", "Saving…");

      try {
        const payload = collectSafeEditorPayload();
        const { error } = await supabase
          .from("form_safe")
          .update(payload)
          .eq("id", row.id);

        if (error) throw error;

        setEntryStatus("ok", "✅ Saved changes.");
        await loadRecentEntries();
      } catch (err) {
        console.error(err);
        setEntryStatus("err", "❌ Save failed: " + (err?.message || "Check RLS."));
      } finally {
        saveBtn.disabled = false;
      }
    };
  }

  // Ensure modal content is scrollable (CSS class exists in your styles)
  // If your styles.css doesn’t include modalOverlay/modal yet, tell me and I’ll add it.
}

function billLine(label, key, qty, centsEach, dis){
  const q = int0(qty);
  const amt = q * centsEach;
  return `
    <tr>
      <td>${esc(label)}</td>
      <td style="max-width:160px"><input ${dis} id="ve_${key}" type="number" min="0" step="1" value="${q}"></td>
      <td class="mono" id="ve_amt_${key}">${money(amt)}</td>
    </tr>
  `;
}
function coinLine(label, key, qty, centsEach, dis){
  const q = int0(qty);
  const amt = q * centsEach;
  return `
    <tr>
      <td>${esc(label)}</td>
      <td style="max-width:160px"><input ${dis} id="ve_${key}" type="number" min="0" step="1" value="${q}"></td>
      <td class="mono" id="ve_amt_${key}">${money(amt)}</td>
    </tr>
  `;
}

function recalcViewEditorTotals(){
  const overlay = ensureModal();

  const billKeys = [
    ["bills_100_qty", 10000],
    ["bills_50_qty", 5000],
    ["bills_20_qty", 2000],
    ["bills_10_qty", 1000],
    ["bills_5_qty", 500],
    ["bills_1_qty", 100],
  ];
  const coinKeys = [
    ["quarters_qty", 25],
    ["dimes_qty", 10],
    ["nickels_qty", 5],
    ["pennies_qty", 1],
  ];

  let bills = 0;
  for (const [k, centsEach] of billKeys){
    const q = int0(overlay.querySelector(`#ve_${k}`)?.value);
    const amt = q * centsEach;
    bills += amt;
    const cell = overlay.querySelector(`#ve_amt_${k}`);
    if (cell) cell.textContent = money(amt);
  }

  const reg1 = toCents(overlay.querySelector("#ve_reg1")?.value);
  const reg2 = toCents(overlay.querySelector("#ve_reg2")?.value);
  const regs = reg1 + reg2;

  let coins = 0;
  for (const [k, centsEach] of coinKeys){
    const q = int0(overlay.querySelector(`#ve_${k}`)?.value);
    const amt = q * centsEach;
    coins += amt;
    const cell = overlay.querySelector(`#ve_amt_${k}`);
    if (cell) cell.textContent = money(amt);
  }

  overlay.querySelector("#ve_bills_sub").textContent = money(bills);
  overlay.querySelector("#ve_regs_sub").textContent = money(regs);
  overlay.querySelector("#ve_coins_sub").textContent = money(coins);
  overlay.querySelector("#ve_total").textContent = money(bills + regs + coins);
}

function collectSafeEditorPayload(){
  const overlay = ensureModal();

  const payload = {
    form_date: overlay.querySelector("#ve_form_date")?.value || null,
    form_time: (overlay.querySelector("#ve_form_time")?.value || "").trim() || null,
    employee_name: (overlay.querySelector("#ve_employee_name")?.value || "").trim() || null,
    notes: (overlay.querySelector("#ve_notes")?.value || "").trim() || null,
    reg1_amount_cents: toCents(overlay.querySelector("#ve_reg1")?.value),
    reg2_amount_cents: toCents(overlay.querySelector("#ve_reg2")?.value),
    bills_100_qty: int0(overlay.querySelector("#ve_bills_100_qty")?.value),
    bills_50_qty:  int0(overlay.querySelector("#ve_bills_50_qty")?.value),
    bills_20_qty:  int0(overlay.querySelector("#ve_bills_20_qty")?.value),
    bills_10_qty:  int0(overlay.querySelector("#ve_bills_10_qty")?.value),
    bills_5_qty:   int0(overlay.querySelector("#ve_bills_5_qty")?.value),
    bills_1_qty:   int0(overlay.querySelector("#ve_bills_1_qty")?.value),
    quarters_qty:  int0(overlay.querySelector("#ve_quarters_qty")?.value),
    dimes_qty:     int0(overlay.querySelector("#ve_dimes_qty")?.value),
    nickels_qty:   int0(overlay.querySelector("#ve_nickels_qty")?.value),
    pennies_qty:   int0(overlay.querySelector("#ve_pennies_qty")?.value),
  };

  return payload;
}

init().catch(err => {
  console.error(err);
  whoamiEl.textContent = "Error loading dashboard.";
});
