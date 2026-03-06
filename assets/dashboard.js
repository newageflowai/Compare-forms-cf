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

// Optional (if your HTML has it)
const profileBtn = $("profileBtn") || document.getElementById("profileBtn");

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

function n0(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function int0(v){ return Math.max(0, Math.trunc(n0(v))); }
function toCents(v){
  const x = n0(String(v).replace(/[$,]/g,""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
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

// ---------- modal (entry + profile) ----------
function ensureModalShell(){
  if (document.getElementById("entryModalOverlay")) return;

  const style = document.createElement("style");
  style.textContent = `
    .modalOverlay{
      position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center;
      padding:18px; z-index:9999;
    }
    .modalCard{
      width:min(980px, 100%);
      max-height:92vh;
      overflow:auto;
      background:rgba(15,17,27,.96);
      border:1px solid rgba(255,255,255,.10);
      border-radius:16px;
      box-shadow:0 12px 60px rgba(0,0,0,.55);
      padding:16px;
    }
    .modalTop{
      display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      margin-bottom:10px;
    }
    .modalTop h3{ margin:0; font-size:18px; }
    .modalTop .sub{ color:rgba(243,246,255,.70); font-size:12px; margin-top:4px; }
    .modalBtns{ display:flex; gap:10px; align-items:center; }
    .modalGrid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width: 760px){ .modalGrid2{ grid-template-columns:1fr; } }
    .miniNote{ color:rgba(243,246,255,.70); font-size:12px; margin-top:6px; }
    .hr{ height:1px; background:rgba(255,255,255,.08); margin:12px 0; }
    .kv{ display:flex; justify-content:space-between; gap:10px; margin-top:8px; }
    .kv b{ font-weight:800; }
    .modalCard table{ width:100%; border-collapse:collapse; }
    .modalCard th,.modalCard td{ padding:8px 6px; border-bottom:1px solid rgba(255,255,255,.08); }
    .modalCard th{ text-align:left; color:rgba(243,246,255,.80); font-size:12px; }
    .modalCard input, .modalCard textarea{
      width:100%;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.04);
      color:inherit;
      outline:none;
    }
    .modalCard textarea{ min-height:90px; resize:vertical; }
    .pill{
      display:inline-block; padding:3px 10px; border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      color:rgba(243,246,255,.85); font-size:12px;
    }
    .rowTight td{ padding:6px; }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px;}
    .modalStatus{ margin-top:10px; }
    .danger{
      border:1px solid rgba(255,90,90,.35) !important;
      background:rgba(255,90,90,.12) !important;
      color:#ffd2d2 !important;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "entryModalOverlay";
  overlay.className = "modalOverlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="modalCard" role="dialog" aria-modal="true" aria-label="Modal">
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
      <div id="entryModalStatus" class="status modalStatus" role="status" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeEntryModal();
  });

  document.getElementById("entryModalClose").addEventListener("click", closeEntryModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEntryModal();
  });
}

function openEntryModal(){
  ensureModalShell();
  const overlay = document.getElementById("entryModalOverlay");
  overlay.style.display = "flex";
}

function closeEntryModal(){
  const overlay = document.getElementById("entryModalOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
  document.getElementById("entryModalBody").innerHTML = "";
  const st = document.getElementById("entryModalStatus");
  st.className = "status modalStatus";
  st.textContent = "";
}

function setModalStatus(type, msg){
  const st = document.getElementById("entryModalStatus");
  st.className = "status modalStatus " + type; // ok | err
  st.textContent = msg;
}

// ---------- Safe entry modal ----------
async function openSafeEntry(id){
  openEntryModal();
  document.getElementById("entryModalTitle").textContent = "Cuadre del Safe";
  document.getElementById("entryModalSub").textContent = `Loading…  ID: ${id}`;
  setModalStatus("", "");

  const isAdmin = (ctx?.profile?.role === "admin");

  try{
    const { data, error } = await supabase
      .from("form_safe")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    document.getElementById("entryModalSub").textContent =
      `${fmtDateTime(data.created_at)} • ID: ${data.id} • ` + (isAdmin ? "Admin: editable" : "User: view-only");

    const body = document.getElementById("entryModalBody");

    body.innerHTML = `
      <div class="modalGrid2">
        <div>
          <label>Date</label>
          <input id="m_date" type="date" value="${esc(String(data.date ?? ""))}" ${isAdmin ? "" : "disabled"} />
        </div>
        <div>
          <label>Time</label>
          <input id="m_time" type="time" value="${esc(String(data.time ?? ""))}" ${isAdmin ? "" : "disabled"} />
        </div>
      </div>

      <div style="margin-top:10px">
        <label>Employee Name</label>
        <input id="m_employee" type="text" value="${esc(String(data.employee_name ?? ""))}" ${isAdmin ? "" : "disabled"} />
      </div>

      <div class="hr"></div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="pill">Bills</div>
        <div class="mono" id="m_bills_sub">${money(calcBills(data))}</div>
      </div>

      <div style="overflow:auto; margin-top:8px;">
        <table>
          <thead>
            <tr><th>Denomination</th><th style="width:160px;">Qty</th><th>Amount</th></tr>
          </thead>
          <tbody class="rowTight">
            ${billRow("$100","bills_100_qty",10000,data,isAdmin)}
            ${billRow("$50","bills_50_qty",5000,data,isAdmin)}
            ${billRow("$20","bills_20_qty",2000,data,isAdmin)}
            ${billRow("$10","bills_10_qty",1000,data,isAdmin)}
            ${billRow("$5","bills_5_qty",500,data,isAdmin)}
            ${billRow("$1","bills_1_qty",100,data,isAdmin)}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="pill">Registers</div>
        <div class="mono" id="m_regs_sub">${money((data.reg1_amount_cents||0) + (data.reg2_amount_cents||0))}</div>
      </div>

      <div class="modalGrid2" style="margin-top:8px;">
        <div>
          <label>Register 1 Amount</label>
          <input id="m_reg1" type="text" value="${esc(((data.reg1_amount_cents||0)/100).toFixed(2))}" ${isAdmin ? "" : "disabled"} />
        </div>
        <div>
          <label>Register 2 Amount</label>
          <input id="m_reg2" type="text" value="${esc(((data.reg2_amount_cents||0)/100).toFixed(2))}" ${isAdmin ? "" : "disabled"} />
        </div>
      </div>
      <div class="miniNote">Tip: you can type 2332.62 (no $ needed).</div>

      <div class="hr"></div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="pill">Coins</div>
        <div class="mono" id="m_coins_sub">${money(calcCoins(data))}</div>
      </div>

      <div style="overflow:auto; margin-top:8px;">
        <table>
          <thead>
            <tr><th>Coin</th><th style="width:160px;">Qty</th><th>Amount</th></tr>
          </thead>
          <tbody class="rowTight">
            ${coinRow("Quarters","quarters_qty",25,data,isAdmin)}
            ${coinRow("Dimes","dimes_qty",10,data,isAdmin)}
            ${coinRow("Nickels","nickels_qty",5,data,isAdmin)}
            ${coinRow("Pennies","pennies_qty",1,data,isAdmin)}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <label>Notes</label>
      <textarea id="m_notes" ${isAdmin ? "" : "disabled"}>${esc(String(data.notes ?? ""))}</textarea>

      <div class="kv">
        <b>TOTAL</b>
        <b class="mono" id="m_total">${money(calcTotalFromRow(data))}</b>
      </div>

      <div class="actions" style="margin-top:12px; justify-content:space-between; align-items:center;">
        <div>
          ${isAdmin ? `<button class="btn danger" id="m_delete" type="button">Delete</button>` : ``}
        </div>
        <div style="display:flex; gap:10px;">
          ${isAdmin ? `<button class="btn" id="m_save" type="button">Save Changes</button>` : ``}
          <button class="btn secondary" id="m_close2" type="button">Close</button>
        </div>
      </div>
    `;

    body.querySelector("#m_close2").addEventListener("click", closeEntryModal);

    const recalc = () => {
      const row = readModalToRow();
      document.getElementById("m_bills_sub").textContent = money(calcBills(row));
      document.getElementById("m_regs_sub").textContent = money((row.reg1_amount_cents||0)+(row.reg2_amount_cents||0));
      document.getElementById("m_coins_sub").textContent = money(calcCoins(row));
      document.getElementById("m_total").textContent = money(calcTotalFromRow(row));

      const billDefs = [
        ["bills_100_qty", 10000],
        ["bills_50_qty",  5000],
        ["bills_20_qty",  2000],
        ["bills_10_qty",  1000],
        ["bills_5_qty",   500],
        ["bills_1_qty",   100],
      ];
      for (const [k, cents] of billDefs){
        const qty = int0(row[k]);
        const cell = document.getElementById("m_amt_"+k);
        if (cell) cell.textContent = money(qty*cents);
      }
      const coinDefs = [
        ["quarters_qty", 25],
        ["dimes_qty", 10],
        ["nickels_qty", 5],
        ["pennies_qty", 1],
      ];
      for (const [k, cents] of coinDefs){
        const qty = int0(row[k]);
        const cell = document.getElementById("m_amt_"+k);
        if (cell) cell.textContent = money(qty*cents);
      }
    };

    body.querySelectorAll("input,textarea").forEach(el => el.addEventListener("input", () => {
      setModalStatus("", "");
      recalc();
    }));

    // Admin save
    if (isAdmin){
      body.querySelector("#m_save").addEventListener("click", async () => {
        try{
          setModalStatus("ok", "Saving…");
          const updated = readModalToRow();

          const payload = {
            date: updated.date || null,
            time: updated.time || null,
            employee_name: updated.employee_name || null,
            bills_100_qty: int0(updated.bills_100_qty),
            bills_50_qty:  int0(updated.bills_50_qty),
            bills_20_qty:  int0(updated.bills_20_qty),
            bills_10_qty:  int0(updated.bills_10_qty),
            bills_5_qty:   int0(updated.bills_5_qty),
            bills_1_qty:   int0(updated.bills_1_qty),
            reg1_amount_cents: int0(updated.reg1_amount_cents),
            reg2_amount_cents: int0(updated.reg2_amount_cents),
            quarters_qty: int0(updated.quarters_qty),
            dimes_qty:    int0(updated.dimes_qty),
            nickels_qty:  int0(updated.nickels_qty),
            pennies_qty:  int0(updated.pennies_qty),
            notes: (updated.notes || "").trim() || null,
          };

          const { error } = await supabase
            .from("form_safe")
            .update(payload)
            .eq("id", id);

          if (error) throw error;

          setModalStatus("ok", "✅ Saved changes.");
          await loadRecentEntries();
        } catch (err){
          console.error(err);
          setModalStatus("err", "❌ Save failed: " + (err?.message || "Check RLS policy for UPDATE."));
        }
      });

      // Admin delete
      body.querySelector("#m_delete").addEventListener("click", async () => {
        const ok = confirm("Delete this entry? This cannot be undone.");
        if (!ok) return;

        try{
          setModalStatus("ok", "Deleting…");

          const { error } = await supabase
            .from("form_safe")
            .delete()
            .eq("id", id);

          if (error) throw error;

          setModalStatus("ok", "✅ Deleted.");
          await loadRecentEntries();
          // close after short tick
          setTimeout(() => closeEntryModal(), 150);
        } catch (err){
          console.error(err);
          setModalStatus("err", "❌ Delete failed: " + (err?.message || "Check RLS policy for DELETE."));
        }
      });
    }

    function readModalToRow(){
      const row = {};
      row.date = body.querySelector("#m_date")?.value || "";
      row.time = body.querySelector("#m_time")?.value || "";
      row.employee_name = body.querySelector("#m_employee")?.value || "";
      row.notes = body.querySelector("#m_notes")?.value || "";

      row.bills_100_qty = int0(body.querySelector("#m_bills_100_qty")?.value);
      row.bills_50_qty  = int0(body.querySelector("#m_bills_50_qty")?.value);
      row.bills_20_qty  = int0(body.querySelector("#m_bills_20_qty")?.value);
      row.bills_10_qty  = int0(body.querySelector("#m_bills_10_qty")?.value);
      row.bills_5_qty   = int0(body.querySelector("#m_bills_5_qty")?.value);
      row.bills_1_qty   = int0(body.querySelector("#m_bills_1_qty")?.value);

      row.reg1_amount_cents = toCents(body.querySelector("#m_reg1")?.value || "");
      row.reg2_amount_cents = toCents(body.querySelector("#m_reg2")?.value || "");

      row.quarters_qty = int0(body.querySelector("#m_quarters_qty")?.value);
      row.dimes_qty    = int0(body.querySelector("#m_dimes_qty")?.value);
      row.nickels_qty  = int0(body.querySelector("#m_nickels_qty")?.value);
      row.pennies_qty  = int0(body.querySelector("#m_pennies_qty")?.value);

      return row;
    }

    recalc();

  } catch (err){
    console.error(err);
    document.getElementById("entryModalSub").textContent = `ID: ${id}`;
    document.getElementById("entryModalBody").innerHTML = `<div class="muted">Could not load entry.</div>`;
    setModalStatus("err", "❌ Load failed: " + (err?.message || "Check RLS policy for SELECT."));
  }
}

function billRow(label, key, unitCents, data, isAdmin){
  const qty = int0(data?.[key]);
  const amt = qty * unitCents;
  return `
    <tr>
      <td>${esc(label)}</td>
      <td><input id="m_${esc(key)}" type="number" min="0" step="1" value="${esc(qty)}" ${isAdmin ? "" : "disabled"} /></td>
      <td class="mono" id="m_amt_${esc(key)}">${money(amt)}</td>
    </tr>
  `;
}
function coinRow(label, key, unitCents, data, isAdmin){
  const qty = int0(data?.[key]);
  const amt = qty * unitCents;
  return `
    <tr>
      <td>${esc(label)}</td>
      <td><input id="m_${esc(key)}" type="number" min="0" step="1" value="${esc(qty)}" ${isAdmin ? "" : "disabled"} /></td>
      <td class="mono" id="m_amt_${esc(key)}">${money(amt)}</td>
    </tr>
  `;
}
function calcBills(row){
  const b100 = int0(row.bills_100_qty) * 10000;
  const b50  = int0(row.bills_50_qty)  * 5000;
  const b20  = int0(row.bills_20_qty)  * 2000;
  const b10  = int0(row.bills_10_qty)  * 1000;
  const b5   = int0(row.bills_5_qty)   * 500;
  const b1   = int0(row.bills_1_qty)   * 100;
  return b100+b50+b20+b10+b5+b1;
}
function calcCoins(row){
  const q = int0(row.quarters_qty) * 25;
  const d = int0(row.dimes_qty)    * 10;
  const n = int0(row.nickels_qty)  * 5;
  const p = int0(row.pennies_qty)  * 1;
  return q+d+n+p;
}
function calcTotalFromRow(row){
  const bills = calcBills(row);
  const regs = (int0(row.reg1_amount_cents) + int0(row.reg2_amount_cents));
  const coins = calcCoins(row);
  return bills + regs + coins;
}

// ---------- Profile modal ----------
async function openProfileModal(){
  openEntryModal();
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

    <div class="miniNote">This updates your profile display name.</div>

    <div class="actions" style="margin-top:12px; justify-content:flex-end;">
      <button class="btn" id="p_save" type="button">Save</button>
      <button class="btn secondary" id="p_close" type="button">Close</button>
    </div>
  `;

  body.querySelector("#p_close").addEventListener("click", closeEntryModal);

  body.querySelector("#p_save").addEventListener("click", async () => {
    try{
      setModalStatus("ok", "Saving…");

      const first_name = (body.querySelector("#p_first")?.value || "").trim();
      const last_name  = (body.querySelector("#p_last")?.value || "").trim();

      // Update profiles row
      const { error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", ctx.user.id);

      if (error) throw error;

      // update local ctx and header
      ctx.profile.first_name = first_name;
      ctx.profile.last_name = last_name;
      renderWhoAmI();

      setModalStatus("ok", "✅ Profile saved.");
      setTimeout(() => closeEntryModal(), 250);
    } catch(err){
      console.error(err);
      setModalStatus("err", "❌ Save failed: " + (err?.message || "Check RLS policy for profiles update."));
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
      <tr class="rowLink" data-type="safe" data-id="${esc(r.id)}" style="cursor:pointer">
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

    recentBody.querySelectorAll("tr.rowLink").forEach((tr) => {
      tr.addEventListener("click", async () => {
        const type = tr.getAttribute("data-type");
        const id = tr.getAttribute("data-id");
        if (type === "safe" && id) await openSafeEntry(id);
      });
    });
  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(err?.message || "Error loading entries.")}</td></tr>`;
  }
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

    // profile button (if exists)
    if (profileBtn){
      profileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openProfileModal();
      });
    } else {
      // If profile button exists but uses a different id, you can fix your HTML:
      // <button id="profileBtn" class="btn secondary" type="button">Profile</button>
      console.warn("Profile button not found (expected id='profileBtn').");
    }

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
