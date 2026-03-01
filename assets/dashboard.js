// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

// --------- helpers ----------
function $(sel) { return document.querySelector(sel); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function toLocalDT(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function setStatus(el, type, msg){
  if (!el) return;
  el.className = "status " + type; // ok | err
  el.textContent = msg;
}
function clearStatus(el){
  if (!el) return;
  el.className = "status";
  el.textContent = "";
}

// --------- DOM ----------
const whoamiEl = $("#whoami");
const logoutBtn = $("#logoutBtn");
const adminLink = $("#adminLink");
const recentBody = $("#recentBody");
const refreshBtn = $("#refreshBtn");
const formStatus = $("#formStatus");

const panels = {
  safe: $("#panel-safe"),
  loteria: $("#panel-loteria"),
  cashpay: $("#panel-cashpay"),
  transfer: $("#panel-transfer"),
  daily: $("#panel-daily"),
};

const tabs = Array.from(document.querySelectorAll(".tab"));

// --------- modal for viewing/editing entries ----------
function ensureModal(){
  if ($("#entryOverlay")) return;

  const div = document.createElement("div");
  div.id = "entryOverlay";
  div.className = "modalOverlay hide";
  div.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="entryTitle">
      <div class="modalHeader">
        <div>
          <h2 id="entryTitle" style="margin:0">View Entry</h2>
          <div class="muted" id="entryMeta"></div>
        </div>
        <button class="smallBtn" id="entryCloseBtn" type="button">Close</button>
      </div>

      <div id="entryModalStatus" class="status" role="status" aria-live="polite"></div>

      <div id="entryBody" class="card" style="margin-top:10px"></div>

      <div class="actions" style="margin-top:12px">
        <button class="btn" id="entrySaveBtn" type="button" style="display:none">Save Changes</button>
        <button class="btn secondary" id="entryCancelBtn" type="button">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  $("#entryCloseBtn").addEventListener("click", closeEntryModal);
  $("#entryCancelBtn").addEventListener("click", closeEntryModal);
  div.addEventListener("click", (e) => { if (e.target === div) closeEntryModal(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !div.classList.contains("hide")) closeEntryModal();
  });
}

function openEntryModal(){
  ensureModal();
  $("#entryOverlay").classList.remove("hide");
  $("#entryOverlay").setAttribute("aria-hidden", "false");
}
function closeEntryModal(){
  const o = $("#entryOverlay");
  if (!o) return;
  o.classList.add("hide");
  o.setAttribute("aria-hidden", "true");
  $("#entryBody").innerHTML = "";
  clearStatus($("#entryModalStatus"));
}

// --------- session/profile ----------
let ctx = {
  user: null,
  profile: null, // { id, org_id, role, first_name, last_name }
};

async function requireSession(){
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) {
    window.location.href = "/index.html";
    return null;
  }
  return user;
}

async function loadProfile(userId){
  // profiles table assumed: id (uuid), org_id (uuid), role (text), first_name, last_name
  // RLS must allow select own row.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, org_id, role, first_name, last_name")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function fullName(p){
  const fn = (p?.first_name || "").trim();
  const ln = (p?.last_name || "").trim();
  const combined = (fn + " " + ln).trim();
  return combined || "(no name)";
}

// --------- tabs ----------
function showTab(key){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hide", k !== key);
  });
}

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    showTab(btn.dataset.tab);
  });
});

// --------- recent entries ----------
async function fetchRecentSafe(){
  // FIX: order() must come AFTER select() in Supabase v2
  let q = supabase
    .from("form_safe")
    .select("id, created_at, form_date, employee_name, notes, org_id")
    .order("created_at", { ascending: false })
    .limit(25);

  // user sees only their org (admin sees all)
  if (ctx.profile?.role !== "admin" && ctx.profile?.org_id) {
    q = q.eq("org_id", ctx.profile.org_id);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map(r => ({
    type: "safe",
    id: r.id,
    created_at: r.created_at,
    form_date: r.form_date,
    employee_name: r.employee_name,
    notes: r.notes,
  }));
}

async function loadRecent(){
  clearStatus(formStatus);
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    const rows = await fetchRecentSafe();

    if (!rows.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = rows.map(r => `
      <tr class="clickRow" data-type="${esc(r.type)}" data-id="${esc(r.id)}" style="cursor:pointer">
        <td>${esc(toLocalDT(r.created_at))}</td>
        <td>${esc(r.type.toUpperCase())}</td>
        <td>${esc(r.form_date || "")}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 40))}${(r.notes && r.notes.length > 40) ? "…" : ""}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    // click handlers
    recentBody.querySelectorAll("tr.clickRow").forEach(tr => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        const type = tr.getAttribute("data-type");
        openEntryViewer(type, id);
      });
    });

  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error loading entries.</td></tr>`;
    setStatus(formStatus, "err", "❌ " + (err?.message || "Failed to load recent entries."));
  }
}

// --------- entry viewer/editor ----------
async function openEntryViewer(type, id){
  ensureModal();
  clearStatus($("#entryModalStatus"));
  $("#entryBody").innerHTML = `<div class="muted">Loading…</div>`;
  $("#entrySaveBtn").style.display = "none";
  $("#entryMeta").textContent = "";
  $("#entryTitle").textContent = "View Entry";
  openEntryModal();

  try {
    if (type !== "safe") {
      $("#entryBody").innerHTML = `<div class="muted">Viewer not implemented for: ${esc(type)}</div>`;
      return;
    }

    const { data, error } = await supabase
      .from("form_safe")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    $("#entryTitle").textContent = "Cuadre del Safe";
    $("#entryMeta").textContent = `ID: ${data.id} • Saved: ${toLocalDT(data.created_at)}`;

    const isAdmin = ctx.profile?.role === "admin";

    // Render as read-only (user) or editable (admin)
    $("#entryBody").innerHTML = renderSafeEntryForm(data, isAdmin);

    if (isAdmin) {
      $("#entrySaveBtn").style.display = "";
      $("#entrySaveBtn").onclick = () => saveSafeEdits(data.id);
    }

  } catch (err) {
    console.error(err);
    $("#entryBody").innerHTML = `<div class="muted">Failed to load entry.</div>`;
    setStatus($("#entryModalStatus"), "err", "❌ " + (err?.message || "Could not open entry."));
  }
}

function renderSafeEntryForm(row, editable){
  const dis = editable ? "" : "disabled";
  const input = (id, label, value, type="text") => `
    <div>
      <label for="${id}">${esc(label)}</label>
      <input id="${id}" type="${type}" value="${esc(value ?? "")}" ${dis} />
    </div>
  `;

  const qty = (key, label, value) => `
    <tr>
      <td>${esc(label)}</td>
      <td style="max-width:160px">
        <input id="edit_${esc(key)}" type="number" min="0" step="1" value="${esc(value ?? 0)}" ${dis}/>
      </td>
    </tr>
  `;

  return `
    <div class="grid2">
      ${input("edit_form_date", "Date", row.form_date ?? "", "date")}
      ${input("edit_form_time", "Time", row.form_time ?? "", "text")}
    </div>

    ${input("edit_employee_name", "Employee Name", row.employee_name ?? "", "text")}

    <div class="sectionTitle" style="margin-top:12px">Bills (Qty)</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Denomination</th><th>Qty</th></tr></thead>
        <tbody>
          ${qty("bills_100_qty", "$100", row.bills_100_qty)}
          ${qty("bills_50_qty", "$50", row.bills_50_qty)}
          ${qty("bills_20_qty", "$20", row.bills_20_qty)}
          ${qty("bills_10_qty", "$10", row.bills_10_qty)}
          ${qty("bills_5_qty", "$5", row.bills_5_qty)}
          ${qty("bills_1_qty", "$1", row.bills_1_qty)}
        </tbody>
      </table>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Registers</div>
    <div class="grid2">
      ${input("edit_reg1_amount_cents", "Register 1 (cents)", row.reg1_amount_cents ?? 0, "number")}
      ${input("edit_reg2_amount_cents", "Register 2 (cents)", row.reg2_amount_cents ?? 0, "number")}
    </div>
    <div class="muted" style="margin-top:6px">Admins edit cents directly (ex: $12.34 = 1234).</div>

    <div class="sectionTitle" style="margin-top:12px">Coins (Qty)</div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>Coin</th><th>Qty</th></tr></thead>
        <tbody>
          ${qty("quarters_qty", "Quarters", row.quarters_qty)}
          ${qty("dimes_qty", "Dimes", row.dimes_qty)}
          ${qty("nickels_qty", "Nickels", row.nickels_qty)}
          ${qty("pennies_qty", "Pennies", row.pennies_qty)}
        </tbody>
      </table>
    </div>

    <label for="edit_notes">Notes</label>
    <textarea id="edit_notes" ${dis}>${esc(row.notes ?? "")}</textarea>

    <div class="totalsRow" style="margin-top:12px">
      <div style="font-weight:800">Saved Registers Total</div>
      <div class="mono" style="font-weight:900">${money((row.reg1_amount_cents ?? 0) + (row.reg2_amount_cents ?? 0))}</div>
    </div>
  `;
}

function int0(v){
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

async function saveSafeEdits(id){
  const st = $("#entryModalStatus");
  clearStatus(st);

  try {
    setStatus(st, "ok", "Saving…");

    const patch = {
      form_date: ($("#edit_form_date").value || "").trim() || null,
      form_time: ($("#edit_form_time").value || "").trim() || null,
      employee_name: ($("#edit_employee_name").value || "").trim() || null,

      bills_100_qty: int0($("#edit_bills_100_qty").value),
      bills_50_qty:  int0($("#edit_bills_50_qty").value),
      bills_20_qty:  int0($("#edit_bills_20_qty").value),
      bills_10_qty:  int0($("#edit_bills_10_qty").value),
      bills_5_qty:   int0($("#edit_bills_5_qty").value),
      bills_1_qty:   int0($("#edit_bills_1_qty").value),

      reg1_amount_cents: int0($("#edit_reg1_amount_cents").value),
      reg2_amount_cents: int0($("#edit_reg2_amount_cents").value),

      quarters_qty: int0($("#edit_quarters_qty").value),
      dimes_qty:    int0($("#edit_dimes_qty").value),
      nickels_qty:  int0($("#edit_nickels_qty").value),
      pennies_qty:  int0($("#edit_pennies_qty").value),

      notes: ($("#edit_notes").value || "").trim() || null,
    };

    const { error } = await supabase
      .from("form_safe")
      .update(patch)
      .eq("id", id);

    if (error) throw error;

    setStatus(st, "ok", "✅ Saved changes.");
    await loadRecent();

  } catch (err) {
    console.error(err);
    setStatus(st, "err", "❌ Save failed: " + (err?.message || "Check RLS."));
  }
}

// --------- init ----------
async function init(){
  try {
    ctx.user = await requireSession();
    ctx.profile = await loadProfile(ctx.user.id);

    whoamiEl.textContent = `${ctx.user.email} • ${fullName(ctx.profile)} • ${String(ctx.profile.role || "user").toUpperCase()}`;

    // admin button
    if (ctx.profile.role === "admin") {
      adminLink.style.display = "";
    } else {
      adminLink.style.display = "none";
    }

    // mount forms
    mountSafeForm(panels.safe, ctx);
    panels.loteria.innerHTML = `<div class="muted">Cuadre de Lotería coming next…</div>`;
    panels.cashpay.innerHTML = `<div class="muted">Cash Payment coming next…</div>`;
    panels.transfer.innerHTML = `<div class="muted">Transfer / Shrinkage coming next…</div>`;
    panels.daily.innerHTML = `<div class="muted">Cuadre Diario coming next…</div>`;

    // tabs default
    showTab("safe");

    // load recent
    await loadRecent();

    // refresh
    refreshBtn.addEventListener("click", loadRecent);

    // when forms save, refresh recent
    window.addEventListener("forms:saved", () => loadRecent());

  } catch (err) {
    console.error(err);
    setStatus(formStatus, "err", "❌ " + (err?.message || "Dashboard failed to load."));
  }
}

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
});

init();
