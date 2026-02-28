// /public/assets/forms/safe.js
import { supabase } from "../supabase.js";

const DENOMS = {
  bills: [
    { key: "bills_100_qty", label: "$100", valueCents: 10000 },
    { key: "bills_50_qty",  label: "$50",  valueCents: 5000 },
    { key: "bills_20_qty",  label: "$20",  valueCents: 2000 },
    { key: "bills_10_qty",  label: "$10",  valueCents: 1000 },
    { key: "bills_5_qty",   label: "$5",   valueCents: 500 },
    { key: "bills_1_qty",   label: "$1",   valueCents: 100 },
  ],
  coins: [
    { key: "quarters_qty", label: "Quarters", valueCents: 25 },
    { key: "dimes_qty",    label: "Dimes",    valueCents: 10 },
    { key: "nickels_qty",  label: "Nickels",  valueCents: 5 },
    { key: "pennies_qty",  label: "Pennies",  valueCents: 1 },
  ],
};

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function n0(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function int0(v){ return Math.max(0, Math.trunc(n0(v))); }
function toCents(v){
  const x = n0(String(v ?? "").replace(/[$,]/g,""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}
function money(cents){
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}

function rowInput({ id, label, placeholder = "", type="text" }){
  return `
    <div>
      <label for="${id}">${esc(label)}</label>
      <input id="${id}" type="${type}" placeholder="${esc(placeholder)}" />
    </div>
  `;
}

function qtyRow({ key, label }){
  const id = `safe_${key}`;
  const amtId = `safe_amt_${key}`;
  return `
    <tr>
      <td>${esc(label)}</td>
      <td style="max-width:160px">
        <input id="${id}" type="number" min="0" step="1" value="0" />
      </td>
      <td class="mono" id="${amtId}">${money(0)}</td>
    </tr>
  `;
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function nowHHMM(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function buildEmployeeName(ctx){
  const p = ctx?.profile || {};
  const first = String(p.first_name || "").trim();
  const last  = String(p.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;

  const email = String(ctx?.user?.email || "").trim();
  if (email && email.includes("@")) return email.split("@")[0];
  return "";
}

export function mountSafeForm(container, ctx){
  container.innerHTML = `
    <form id="safeForm">
      <div class="grid2">
        ${rowInput({ id:"safe_date", label:"Date", type:"date" })}
        ${rowInput({ id:"safe_time", label:"Time", type:"time" })}
      </div>

      ${rowInput({ id:"safe_employee", label:"Employee Name", placeholder:"Name on the form" })}

      <div class="sectionTitle">Bills</div>
      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Denomination</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${DENOMS.bills.map(b => qtyRow({ key:b.key, label:b.label })).join("")}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2" style="text-align:right">Bills Subtotal</th>
              <th class="mono" id="safe_bills_subtotal">${money(0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="sectionTitle" style="margin-top:12px">Registers</div>
      <div class="grid2">
        ${rowInput({ id:"safe_reg1", label:"Register 1 Amount", placeholder:"0.00", type:"text" })}
        ${rowInput({ id:"safe_reg2", label:"Register 2 Amount", placeholder:"0.00", type:"text" })}
      </div>
      <div class="muted" style="margin-top:6px">Tip: you can type 2332.62 (no $ needed).</div>

      <div class="totalsRow">
        <div class="muted">Registers Subtotal</div>
        <div class="mono" id="safe_regs_subtotal">${money(0)}</div>
      </div>

      <div class="sectionTitle" style="margin-top:12px">Coins</div>
      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Coin</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${DENOMS.coins.map(c => qtyRow({ key:c.key, label:c.label })).join("")}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2" style="text-align:right">Coins Subtotal</th>
              <th class="mono" id="safe_coins_subtotal">${money(0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <label for="safe_notes">Notes</label>
      <textarea id="safe_notes" placeholder="Optional notes…"></textarea>

      <div class="totalsRow" style="margin-top:12px">
        <div style="font-weight:800">TOTAL (Bills + Registers + Coins)</div>
        <div class="mono" id="safe_total" style="font-weight:900">${money(0)}</div>
      </div>

      <div class="actions" style="margin-top:12px">
        <button class="btn" id="safe_submit" type="submit">Save Cuadre del Safe</button>
        <button class="btn secondary" id="safe_clear" type="button">Clear</button>
      </div>

      <div id="safe_status" class="status" role="status" aria-live="polite"></div>
    </form>
  `;

  const form = container.querySelector("#safeForm");
  const statusEl = container.querySelector("#safe_status");
  const submitBtn = container.querySelector("#safe_submit");

  const dateEl = container.querySelector("#safe_date");
  const timeEl = container.querySelector("#safe_time");
  const empEl  = container.querySelector("#safe_employee");
  const reg1El = container.querySelector("#safe_reg1");
  const reg2El = container.querySelector("#safe_reg2");
  const notesEl = container.querySelector("#safe_notes");

  const billsSubtotalEl = container.querySelector("#safe_bills_subtotal");
  const regsSubtotalEl  = container.querySelector("#safe_regs_subtotal");
  const coinsSubtotalEl = container.querySelector("#safe_coins_subtotal");
  const totalEl         = container.querySelector("#safe_total");

  function setStatus(type, msg){
    statusEl.className = "status " + type; // ok | err
    statusEl.textContent = msg;
  }
  function clearStatus(){
    statusEl.className = "status";
    statusEl.textContent = "";
  }

  function calc(){
    let bills = 0;
    for (const b of DENOMS.bills){
      const qty = int0(container.querySelector(`#safe_${b.key}`)?.value);
      const amt = qty * b.valueCents;
      bills += amt;
      const cell = container.querySelector(`#safe_amt_${b.key}`);
      if (cell) cell.textContent = money(amt);
    }

    const reg1 = toCents(reg1El.value);
    const reg2 = toCents(reg2El.value);
    const regs = reg1 + reg2;

    let coins = 0;
    for (const c of DENOMS.coins){
      const qty = int0(container.querySelector(`#safe_${c.key}`)?.value);
      const amt = qty * c.valueCents;
      coins += amt;
      const cell = container.querySelector(`#safe_amt_${c.key}`);
      if (cell) cell.textContent = money(amt);
    }

    billsSubtotalEl.textContent = money(bills);
    regsSubtotalEl.textContent  = money(regs);
    coinsSubtotalEl.textContent = money(coins);
    totalEl.textContent         = money(bills + regs + coins);

    return { bills, reg1, reg2, coins, total: bills + regs + coins };
  }

  // Defaults
  dateEl.value = todayISO();
  timeEl.value = nowHHMM();
  empEl.value = buildEmployeeName(ctx);

  // live calc
  container.querySelectorAll("input,textarea").forEach(el => {
    el.addEventListener("input", () => { calc(); clearStatus(); });
  });

  // clear
  container.querySelector("#safe_clear").addEventListener("click", () => {
    form.reset();
    dateEl.value = todayISO();
    timeEl.value = nowHHMM();
    empEl.value = buildEmployeeName(ctx);

    [...DENOMS.bills, ...DENOMS.coins].forEach(x => {
      const el = container.querySelector(`#safe_${x.key}`);
      if (el) el.value = "0";
    });

    reg1El.value = "";
    reg2El.value = "";
    notesEl.value = "";
    calc();
    clearStatus();
  });

  async function tryInsert(payload){
    return await supabase.from("form_safe").insert(payload).select("id, created_at").single();
  }

  // submit -> Supabase insert
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    if (!ctx?.user?.id) return setStatus("err", "❌ Not logged in.");

    const employee_name = (empEl.value || "").trim();
    if (!employee_name) return setStatus("err", "❌ Employee name is required.");

    const computed = calc();

    // Always use the user's org_id (admin can see all via RLS; you can change later if you want admin to choose org)
    const org_id = ctx?.profile?.org_id ?? null;
    if (!org_id && (ctx?.profile?.role || "") !== "admin") {
      return setStatus("err", "❌ Your profile has no org assigned. Admin must assign your org.");
    }

    // We will attempt BOTH schemas:
    const date = (dateEl.value || "").trim();
    const time = (timeEl.value || "").trim();
    if (!date) return setStatus("err", "❌ Date is required.");

    // qty fields
    const qtyFields = {};
    for (const b of DENOMS.bills) qtyFields[b.key] = int0(container.querySelector(`#safe_${b.key}`)?.value);
    for (const c of DENOMS.coins) qtyFields[c.key] = int0(container.querySelector(`#safe_${c.key}`)?.value);

    const base = {
      org_id,
      created_by: ctx.user.id,
      employee_name,
      reg1_amount_cents: computed.reg1,
      reg2_amount_cents: computed.reg2,
      notes: (notesEl.value || "").trim() || null,
      ...qtyFields,
    };

    const payloadNew = { ...base, form_date: date, form_time: time || null }; // NEW columns
    const payloadOld = { ...base, date: date, time: time || null };           // OLD columns

    try {
      submitBtn.disabled = true;
      setStatus("ok", "Saving…");

      // Try new schema first
      let res = await tryInsert(payloadNew);

      // If schema cache says form_date doesn't exist, retry old
      if (res.error && String(res.error.message || "").includes("schema cache") && String(res.error.message || "").includes("form_date")) {
        res = await tryInsert(payloadOld);
      }

      // If schema cache says date doesn't exist, retry new
      if (res.error && String(res.error.message || "").includes("schema cache") && String(res.error.message || "").includes("date")) {
        res = await tryInsert(payloadNew);
      }

      if (res.error) throw res.error;

      setStatus("ok", `✅ Saved. Entry ID: ${res.data.id}`);
      window.dispatchEvent(new CustomEvent("forms:saved", { detail: { type:"safe", id: res.data.id } }));

      // After save, bump time forward to now (common workflow)
      timeEl.value = nowHHMM();

    } catch (err) {
      console.error(err);
      setStatus("err", "❌ Save failed: " + (err?.message || "Check RLS policies / schema cache."));
    } finally {
      submitBtn.disabled = false;
    }
  });

  // init qty to 0 and calc
  [...DENOMS.bills, ...DENOMS.coins].forEach(x => {
    const el = container.querySelector(`#safe_${x.key}`);
    if (el && (el.value === "" || el.value == null)) el.value = "0";
  });
  calc();
}
