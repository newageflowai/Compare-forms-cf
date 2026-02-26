import { supabase } from "./supabaseClient.js";

export function dollarsToCents(v){
  const n = Number(String(v || "0").replace(/[^0-9.\-]/g,""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
export function centsToDollars(cents){
  const n = Number(cents || 0) / 100;
  return n.toFixed(2);
}
export function setStatus(el, type, msg){
  el.className = "status " + type;
  el.textContent = msg;
}
export function clearStatus(el){
  el.className = "status";
  el.textContent = "";
}

export function renderSafe(panel){
  panel.innerHTML = `
    <h2>Cuadre del Safe</h2>
    <div class="row">
      <div><label>Date</label><input id="safe_date" type="date" /></div>
      <div><label>Time</label><input id="safe_time" placeholder="8:00 AM" /></div>
    </div>
    <label>Employee Name</label><input id="safe_employee" placeholder="Sandra Rodriguez" />

    <div class="row">
      <div><label>$100 qty</label><input id="b100" type="number" min="0" value="0"/></div>
      <div><label>$50 qty</label><input id="b50" type="number" min="0" value="0"/></div>
    </div>
    <div class="row">
      <div><label>$20 qty</label><input id="b20" type="number" min="0" value="0"/></div>
      <div><label>$10 qty</label><input id="b10" type="number" min="0" value="0"/></div>
    </div>
    <div class="row">
      <div><label>$5 qty</label><input id="b5" type="number" min="0" value="0"/></div>
      <div><label>$1 qty</label><input id="b1" type="number" min="0" value="0"/></div>
    </div>

    <div class="row">
      <div><label>Cash Register 1 ($)</label><input id="reg1" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Cash Register 2 ($)</label><input id="reg2" inputmode="decimal" placeholder="0.00"/></div>
    </div>

    <div class="row">
      <div><label>Quarters qty</label><input id="qtrs" type="number" min="0" value="0"/></div>
      <div><label>Dimes qty</label><input id="dimes" type="number" min="0" value="0"/></div>
    </div>
    <div class="row">
      <div><label>Nickels qty</label><input id="nickels" type="number" min="0" value="0"/></div>
      <div><label>Pennies qty</label><input id="pennies" type="number" min="0" value="0"/></div>
    </div>

    <label>Notes</label><textarea id="safe_notes"></textarea>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="safe_submit" type="button">Submit Safe</button>
    </div>
  `;
}

export function renderLoteria(panel){
  panel.innerHTML = `
    <h2>Cuadre de Lotería</h2>
    <div class="row">
      <div><label>Date</label><input id="lot_date" type="date" /></div>
      <div><label>Employee Name</label><input id="lot_employee" placeholder="Sandra" /></div>
    </div>
    <label>Starting Balance ($)</label><input id="lot_start" inputmode="decimal" placeholder="0.00" />

    <h3 style="margin-top:14px">Entradas</h3>
    <div class="row">
      <div><label>Scratches $10 IN ($)</label><input id="lot_s10" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Scratches Other IN ($)</label><input id="lot_sx" inputmode="decimal" placeholder="0.00"/></div>
    </div>
    <div class="row">
      <div><label>Draw Game Sales ($)</label><input id="lot_sales" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Cash Deposit ($)</label><input id="lot_dep" inputmode="decimal" placeholder="0.00"/></div>
    </div>

    <h3 style="margin-top:14px">Salidas</h3>
    <div class="row">
      <div><label>Draw Game Cashes ($)</label><input id="lot_cashes" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Promo Plays ($)</label><input id="lot_promo" inputmode="decimal" placeholder="0.00"/></div>
    </div>
    <div class="row">
      <div><label>Cancels ($)</label><input id="lot_cancel" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Instant Cashes ($)</label><input id="lot_inst" inputmode="decimal" placeholder="0.00"/></div>
    </div>
    <div class="row">
      <div><label>To Deposit ($)</label><input id="lot_todep" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Refund ($)</label><input id="lot_ref" inputmode="decimal" placeholder="0.00"/></div>
    </div>

    <div class="row">
      <div><label>Cash in Drawer ($)</label><input id="lot_drawer" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Balance ($)</label><input id="lot_balance" inputmode="decimal" placeholder="0.00"/></div>
    </div>

    <label>Notes</label><textarea id="lot_notes"></textarea>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="lot_submit" type="button">Submit Lotería</button>
    </div>
  `;
}

export function renderCashPayment(panel){
  panel.innerHTML = `
    <h2>Cash Payment / Pago en Efectivo</h2>
    <div class="row">
      <div><label>Date</label><input id="cp_date" type="date" /></div>
      <div><label>Amount ($)</label><input id="cp_amount" inputmode="decimal" placeholder="0.00" /></div>
    </div>
    <label>Given To</label><input id="cp_given_to" />
    <label>Reason</label><input id="cp_reason" />
    <div class="row">
      <div><label>Given By</label><input id="cp_given_by" /></div>
      <div><label>Received By</label><input id="cp_received_by" /></div>
    </div>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="cp_submit" type="button">Submit Cash Payment</button>
    </div>
  `;
}

export function renderTransfer(panel){
  panel.innerHTML = `
    <h2>Transfer / Shrinkage Report</h2>
    <div class="row">
      <div><label>Transfer Date</label><input id="tr_date" type="date" /></div>
      <div><label>From / To</label>
        <div class="row">
          <input id="tr_from" placeholder="MEAT" />
          <input id="tr_to" placeholder="HOT DELI" />
        </div>
      </div>
    </div>

    <div class="row">
      <div><label>Item Code</label><input id="tr_item" placeholder="1212" /></div>
      <div><label>Description</label><input id="tr_desc" placeholder="RABO DE RES" /></div>
    </div>

    <div class="row">
      <div><label>Qty</label><input id="tr_qty" inputmode="decimal" placeholder="0" /></div>
      <div><label>Price ($)</label><input id="tr_price" inputmode="decimal" placeholder="0.00" /></div>
    </div>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="tr_submit" type="button">Submit Transfer Line</button>
    </div>

    <div class="small" style="margin-top:10px">
      Tip: This submits one line at a time (you can add multiple lines like the paper form).
    </div>
  `;
}

export function renderDaily(panel){
  panel.innerHTML = `
    <h2>Cuadre Diario</h2>
    <div class="row">
      <div><label>Date</label><input id="d_date" type="date" /></div>
      <div><label>Shift</label>
        <select id="d_shift">
          <option value="manana">Mañana</option>
          <option value="noche">Noche</option>
        </select>
      </div>
    </div>

    <label>Responsible</label><input id="d_resp" />

    <div class="row">
      <div><label>Balance Inicial ($)</label><input id="d_bi" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Total Entradas ($)</label><input id="d_te" inputmode="decimal" placeholder="0.00"/></div>
    </div>
    <div class="row">
      <div><label>Total Salidas ($)</label><input id="d_ts" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Cash on Safe ($)</label><input id="d_cs" inputmode="decimal" placeholder="0.00"/></div>
    </div>
    <div class="row">
      <div><label>Balance Final ($)</label><input id="d_bf" inputmode="decimal" placeholder="0.00"/></div>
      <div><label>Notes</label><input id="d_notes" /></div>
    </div>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="d_submit" type="button">Submit Daily</button>
    </div>
  `;
}

export async function submitHandlers({ profile, statusEl }){
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("No session");

  // SAFE
  document.getElementById("safe_submit")?.addEventListener("click", async () => {
    try{
      clearStatus(statusEl);
      setStatus(statusEl, "ok", "Saving Safe…");

      const row = {
        org_id: profile.org_id,
        created_by: user.id,
        form_date: document.getElementById("safe_date").value,
        form_time: document.getElementById("safe_time").value || null,
        employee_name: document.getElementById("safe_employee").value || null,

        bills_100_qty: Number(document.getElementById("b100").value || 0),
        bills_50_qty: Number(document.getElementById("b50").value || 0),
        bills_20_qty: Number(document.getElementById("b20").value || 0),
        bills_10_qty: Number(document.getElementById("b10").value || 0),
        bills_5_qty: Number(document.getElementById("b5").value || 0),
        bills_1_qty: Number(document.getElementById("b1").value || 0),

        reg1_amount_cents: dollarsToCents(document.getElementById("reg1").value),
        reg2_amount_cents: dollarsToCents(document.getElementById("reg2").value),

        quarters_qty: Number(document.getElementById("qtrs").value || 0),
        dimes_qty: Number(document.getElementById("dimes").value || 0),
        nickels_qty: Number(document.getElementById("nickels").value || 0),
        pennies_qty: Number(document.getElementById("pennies").value || 0),

        notes: document.getElementById("safe_notes").value || null
      };

      if (!row.form_date) return setStatus(statusEl, "err", "❌ Date is required.");

      const { error } = await supabase.from("form_safe").insert(row);
      if (error) throw error;

      setStatus(statusEl, "ok", "✅ Safe saved.");
    } catch(e){
      setStatus(statusEl, "err", "❌ " + (e?.message || "Save failed"));
    }
  });

  // LOTERIA
  document.getElementById("lot_submit")?.addEventListener("click", async () => {
    try{
      clearStatus(statusEl);
      setStatus(statusEl, "ok", "Saving Lotería…");

      const row = {
        org_id: profile.org_id,
        created_by: user.id,
        form_date: document.getElementById("lot_date").value,
        employee_name: document.getElementById("lot_employee").value || null,
        starting_balance_cents: dollarsToCents(document.getElementById("lot_start").value),

        scratches_10_in_cents: dollarsToCents(document.getElementById("lot_s10").value),
        scratches_other_in_cents: dollarsToCents(document.getElementById("lot_sx").value),
        draw_game_sales_cents: dollarsToCents(document.getElementById("lot_sales").value),
        cash_deposit_cents: dollarsToCents(document.getElementById("lot_dep").value),

        draw_game_cashes_cents: dollarsToCents(document.getElementById("lot_cashes").value),
        draw_promo_plays_cents: dollarsToCents(document.getElementById("lot_promo").value),
        draw_game_cancels_cents: dollarsToCents(document.getElementById("lot_cancel").value),
        instant_cashes_cents: dollarsToCents(document.getElementById("lot_inst").value),
        to_deposit_cents: dollarsToCents(document.getElementById("lot_todep").value),
        refund_cents: dollarsToCents(document.getElementById("lot_ref").value),

        cash_in_drawer_cents: dollarsToCents(document.getElementById("lot_drawer").value),
        balance_cents: dollarsToCents(document.getElementById("lot_balance").value),

        notes: document.getElementById("lot_notes").value || null
      };

      if (!row.form_date) return setStatus(statusEl, "err", "❌ Date is required.");

      const { error } = await supabase.from("form_loteria").insert(row);
      if (error) throw error;

      setStatus(statusEl, "ok", "✅ Lotería saved.");
    } catch(e){
      setStatus(statusEl, "err", "❌ " + (e?.message || "Save failed"));
    }
  });

  // CASH PAYMENT
  document.getElementById("cp_submit")?.addEventListener("click", async () => {
    try{
      clearStatus(statusEl);
      setStatus(statusEl, "ok", "Saving Cash Payment…");

      const row = {
        org_id: profile.org_id,
        created_by: user.id,
        pay_date: document.getElementById("cp_date").value,
        amount_cents: dollarsToCents(document.getElementById("cp_amount").value),
        given_to: document.getElementById("cp_given_to").value || null,
        reason: document.getElementById("cp_reason").value || null,
        given_by: document.getElementById("cp_given_by").value || null,
        received_by: document.getElementById("cp_received_by").value || null
      };

      if (!row.pay_date) return setStatus(statusEl, "err", "❌ Date is required.");
      const { error } = await supabase.from("form_cash_payment").insert(row);
      if (error) throw error;

      setStatus(statusEl, "ok", "✅ Cash payment saved.");
    } catch(e){
      setStatus(statusEl, "err", "❌ " + (e?.message || "Save failed"));
    }
  });

  // TRANSFER LINE
  document.getElementById("tr_submit")?.addEventListener("click", async () => {
    try{
      clearStatus(statusEl);
      setStatus(statusEl, "ok", "Saving Transfer line…");

      const qty = Number(document.getElementById("tr_qty").value || 0);
      const priceCents = dollarsToCents(document.getElementById("tr_price").value);
      const totalCents = Math.round(qty * priceCents);

      const row = {
        org_id: profile.org_id,
        created_by: user.id,
        transfer_date: document.getElementById("tr_date").value,
        dept_from: document.getElementById("tr_from").value || null,
        dept_to: document.getElementById("tr_to").value || null,
        item_code: document.getElementById("tr_item").value || null,
        description: document.getElementById("tr_desc").value || null,
        qty: qty || null,
        price_cents: priceCents || null,
        total_cents: totalCents || null
      };

      if (!row.transfer_date) return setStatus(statusEl, "err", "❌ Date is required.");

      const { error } = await supabase.from("form_transfer").insert(row);
      if (error) throw error;

      setStatus(statusEl, "ok", "✅ Transfer line saved.");
    } catch(e){
      setStatus(statusEl, "err", "❌ " + (e?.message || "Save failed"));
    }
  });

  // DAILY
  document.getElementById("d_submit")?.addEventListener("click", async () => {
    try{
      clearStatus(statusEl);
      setStatus(statusEl, "ok", "Saving Daily…");

      const row = {
        org_id: profile.org_id,
        created_by: user.id,
        form_date: document.getElementById("d_date").value,
        shift: document.getElementById("d_shift").value,
        responsible: document.getElementById("d_resp").value || null,
        balance_inicial_cents: dollarsToCents(document.getElementById("d_bi").value),
        total_entradas_cents: dollarsToCents(document.getElementById("d_te").value),
        total_salidas_cents: dollarsToCents(document.getElementById("d_ts").value),
        cash_on_safe_cents: dollarsToCents(document.getElementById("d_cs").value),
        balance_final_cents: dollarsToCents(document.getElementById("d_bf").value),
        notes: document.getElementById("d_notes").value || null
      };

      if (!row.form_date) return setStatus(statusEl, "err", "❌ Date is required.");
      const { error } = await supabase.from("form_daily").insert(row);
      if (error) throw error;

      setStatus(statusEl, "ok", "✅ Daily saved.");
    } catch(e){
      setStatus(statusEl, "err", "❌ " + (e?.message || "Save failed"));
    }
  });
}
