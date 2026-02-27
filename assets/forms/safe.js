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
  const x = n0(String(v).replace(/[$,]/g,""));
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

// === date/time helpers for <input type="date"> and <input type="time">
function pad2(n){ return String(n).padStart(2, "0"); }
function nowLocalDateValue(d = new Date()){
  // YYYY-MM-DD
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function nowLocalTimeValue(d = new Date()){
  // HH:MM (24h)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Employee display name from profile
function defaultEmployeeName(ctx){
  const first = (ctx?.profile?.first_name || "").trim();
  const last  = (ctx?.profile?.last_name || "").trim();

  // You asked: autopopulate with first name
  if (first) return first;

  const full = `${first} ${last}`.trim();
  if (full) return full;

  const email = (ctx?.user?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];

  return "";
}

export function mountSafeForm(container, ctx){
  // ctx: { profile: { org_id, role, first_name, last_name }, user }
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

  function setDateTimeNow(){
    const d = new Date();
    dateEl.value = nowLocalDateValue(d);
    timeEl.value = nowLocalTimeValue(d);
  }

  function prefillEmployee(){
    // only fill if empty (don’t overwrite if user already typed)
    if (!empEl.value.trim()) {
      empEl.value = defaultEmployeeName(ctx);
    }
  }

  // live calc
  container.querySelectorAll("input,textarea").forEach(el => {
    el.addEventListener("input", () => { calc(); clearStatus(); });
  });

  // clear
  container.querySelector("#safe_clear").addEventListener("click", () => {
    form.reset();

    // force all qty inputs to 0 (reset may set empty)
    [...DENOMS.bills, ...DENOMS.coins].forEach(x => {
      const el = container.querySelector(`#safe_${x.key}`);
      if (el) el.value = "0";
    });

    reg1El.value = "";
    reg2El.value = "";
    notesEl.value = "";

    // re-apply defaults
    setDateTimeNow();
    prefillEmployee();

    calc();
    clearStatus();
  });

  // submit -> Supabase insert
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    // IMPORTANT: DB columns are form_date + form_time
    const form_date = (dateEl.value || "").trim();
    const form_time = (timeEl.value || "").trim();
    const employee_name = (empEl.value || "").trim();
    const notes = (notesEl.value || "").trim();

    if (!ctx?.user?.id) return setStatus("err", "❌ Not logged in.");
    if (!ctx?.profile?.org_id) return setStatus("err", "❌ Your profile has no org assigned. Admin must assign your org.");
    if (!form_date) return setStatus("err", "❌ Date is required.");
    if (!employee_name) return setStatus("err", "❌ Employee name is required.");

    const computed = calc();

    // Build payload (match your schema)
    const payload = {
      org_id: ctx.profile.org_id,
      created_by: ctx.user.id,

      form_date,
      form_time: form_time || null,

      employee_name,
      reg1_amount_cents: computed.reg1,
      reg2_amount_cents: computed.reg2,
      notes: notes || null,
    };

    // qty fields
    for (const b of DENOMS.bills){
      payload[b.key] = int0(container.querySelector(`#safe_${b.key}`)?.value);
    }
    for (const c of DENOMS.coins){
      payload[c.key] = int0(container.querySelector(`#safe_${c.key}`)?.value);
    }

    try {
      submitBtn.disabled = true;
      setStatus("ok", "Saving…");

      const { data, error } = await supabase
        .from("form_safe")
        .insert(payload)
        .select("id, created_at")
        .single();

      if (error) throw error;

      setStatus("ok", `✅ Saved. Entry ID: ${data.id}`);

      // set new defaults after save (your request)
      setDateTimeNow();
      prefillEmployee();

      // optionally clear money fields after save (comment out if you want to keep values)
      // [...DENOMS.bills, ...DENOMS.coins].forEach(x => {
      //   const el = container.querySelector(`#safe_${x.key}`);
      //   if (el) el.value = "0";
      // });
      // reg1El.value = "";
      // reg2El.value = "";
      // notesEl.value = "";
      // calc();

      window.dispatchEvent(new CustomEvent("forms:saved", { detail: { type:"safe", id:data.id } }));
    } catch (err) {
      console.error(err);
      setStatus("err", "❌ Save failed: " + (err?.message || "Check RLS policies."));
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ===== initial defaults =====
  // default qty inputs to 0
  [...DENOMS.bills, ...DENOMS.coins].forEach(x => {
    const el = container.querySelector(`#safe_${x.key}`);
    if (el && (el.value === "" || el.value == null)) el.value = "0";
  });

  // auto-fill date/time + employee
  setDateTimeNow();
  prefillEmployee();

  // initial calc
  calc();
}
