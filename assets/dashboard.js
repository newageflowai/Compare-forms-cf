// /public/assets/dashboard.js
import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

// --------- helpers ----------
function $(sel) { return document.querySelector(sel); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
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
let ctx = { user: null, profile: null };

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
  return (fn + " " + ln).trim() || "(no name)";
}

// --------- tabs ----------
function showTab(key){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hide", k !== key);
  });
}
tabs.forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

// ✅ IMPORTANT FIX:
// Recent Entries MUST NOT reference form_date directly in select() if DB doesn't have it.
// We select("*") and then use row.form_date || row.date
async function fetchRecentSafe(){
  let q = supabase
    .from("form_safe")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);

  if (ctx.profile?.role !== "admin" && ctx.profile?.org_id) {
    q = q.eq("org_id", ctx.profile.org_id);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map(r => ({
    type: "safe",
    id: r.id,
    created_at: r.created_at,
    // supports either column naming
    form_date: r.form_date ?? r.date ?? "",
    employee_name: r.employee_name ?? "",
    notes: r.notes ?? "",
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
        <td>${esc(r.form_date)}</td>
        <td>${esc(r.employee_name)}</td>
        <td>${esc(String(r.notes).slice(0, 40))}${(r.notes && String(r.notes).length > 40) ? "…" : ""}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

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

// --------- entry viewer/editor (SAFE) ----------
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

  const dateVal = row.form_date ?? row.date ?? "";
  const timeVal = row.form_time ?? row.time ?? "";

  return `
    <div class="grid2">
      ${input("edit_form_date", "Date", dateVal, "date")}
      ${input("edit_form_time", "Time", timeVal, "text")}
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

    // We’ll update BOTH possible naming styles safely:
    // If your table uses form_date/form_time, those will update.
    // If it uses date/time, those will update.
    // (Unknown columns are NOT sent.)
    const dateVal = ($("#edit_form_date").value || "").trim() || null;
    const timeVal = ($("#edit_form_time").value || "").trim() || null;

    const patch = {
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

    // Add date/time keys in a tolerant way (only one will exist in your DB)
    // We'll try update with form_date/form_time first; if it errors, retry with date/time.
    let { error } = await supabase.from("form_safe").update({
      ...patch,
      form_date: dateVal,
      form_time: timeVal,
    }).eq("id", id);

    if (error && /column .*form_date|form_time does not exist/i.test(error.message || "")) {
      // fallback naming
      const res = await supabase.from("form_safe").update({
        ...patch,
        date: dateVal,
        time: timeVal,
      }).eq("id", id);
      error = res.error;
    }

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

    if (ctx.profile.role === "admin") adminLink.style.display = "";
    else adminLink.style.display = "none";

    // mount forms
    mountSafeForm(panels.safe, ctx);
    panels.loteria.innerHTML = `<div class="muted">Cuadre de Lotería coming next…</div>`;
    panels.cashpay.innerHTML = `<div class="muted">Cash Payment coming next…</div>`;
    panels.transfer.innerHTML = `<div class="muted">Transfer / Shrinkage coming next…</div>`;
    panels.daily.innerHTML = `<div class="muted">Cuadre Diario coming next…</div>`;

    showTab("safe");
    await loadRecent();

    refreshBtn.addEventListener("click", loadRecent);
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
