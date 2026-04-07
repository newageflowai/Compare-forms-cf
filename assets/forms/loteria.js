import { supabase } from "../supabase.js";

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function n0(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function toCents(v){
  const x = n0(String(v ?? "").replace(/[$,]/g, ""));
  return Math.round(x * 100);
}
function centsToInput(cents){
  return ((Number(cents) || 0) / 100).toFixed(2);
}
function money(cents){
  return ((Number(cents) || 0) / 100).toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function todayISODate(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function inputRow(id, label, placeholder = "0.00"){
  return `
    <div>
      <label for="${id}">${esc(label)}</label>
      <input id="${id}" type="text" placeholder="${esc(placeholder)}" />
    </div>
  `;
}

export function mountLoteriaForm(container, ctx){
  container.innerHTML = `
    <form id="loteriaForm">
      <div class="grid2">
        <div>
          <label for="lot_date">Date</label>
          <input id="lot_date" type="date" />
        </div>
        <div>
          <label for="lot_employee">Employee Name</label>
          <input id="lot_employee" type="text" placeholder="Name on the form" />
        </div>
      </div>

      <div class="sectionTitle">Starting Balance</div>
      ${inputRow("lot_starting_balance", "Starting Balance")}

      <div class="sectionTitle">Entradas</div>
      <div class="grid2">
        ${inputRow("lot_scratch_10_am", "Scratch $10 AM")}
        ${inputRow("lot_scratch_10_pm", "Scratch $10 PM")}

        ${inputRow("lot_draw_game_sales_am", "Draw Game Sales AM")}
        ${inputRow("lot_draw_game_sales_pm", "Draw Game Sales PM")}

        ${inputRow("lot_cash_deposit_am", "Cash Deposit AM")}
        ${inputRow("lot_cash_deposit_pm", "Cash Deposit PM")}
      </div>

      <div class="totalsRow">
        <div class="muted">Entradas Subtotal</div>
        <div class="mono" id="lot_entries_subtotal">${money(0)}</div>
      </div>

      <div class="sectionTitle">Salidas</div>
      <div class="grid2">
        ${inputRow("lot_draw_game_cashes_am", "Draw Game Cashes AM")}
        ${inputRow("lot_draw_game_cashes_pm", "Draw Game Cashes PM")}

        ${inputRow("lot_draw_promo_plays_am", "Draw Promo Plays AM")}
        ${inputRow("lot_draw_promo_plays_pm", "Draw Promo Plays PM")}

        ${inputRow("lot_draw_game_cancels_am", "Draw Game Cancels AM")}
        ${inputRow("lot_draw_game_cancels_pm", "Draw Game Cancels PM")}

        ${inputRow("lot_instant_cashes_am", "Instant Cashes AM")}
        ${inputRow("lot_instant_cashes_pm", "Instant Cashes PM")}

        ${inputRow("lot_to_deposit_am", "To Deposit AM")}
        ${inputRow("lot_to_deposit_pm", "To Deposit PM")}

        ${inputRow("lot_refund_am", "Refund AM")}
        ${inputRow("lot_refund_pm", "Refund PM")}
      </div>

      <div class="totalsRow">
        <div class="muted">Salidas Subtotal</div>
        <div class="mono" id="lot_exits_subtotal">${money(0)}</div>
      </div>

      <div class="sectionTitle">Drawer / Balance</div>
      <div class="grid2">
        ${inputRow("lot_cash_in_drawer", "Cash in Drawer")}
        <div>
          <label>Calculated Balance</label>
          <input id="lot_balance" type="text" readonly />
        </div>
      </div>

      <label for="lot_notes">Notes</label>
      <textarea id="lot_notes" placeholder="Optional notes…"></textarea>

      <div class="actions" style="margin-top:12px">
        <button class="btn" id="lot_submit" type="submit">Save Cuadre de Lotería</button>
        <button class="btn secondary" id="lot_clear" type="button">Clear</button>
      </div>

      <div id="lot_status" class="status hide" role="status" aria-live="polite"></div>
    </form>
  `;

  const form = container.querySelector("#loteriaForm");
  const statusEl = container.querySelector("#lot_status");

  const dateEl = container.querySelector("#lot_date");
  const employeeEl = container.querySelector("#lot_employee");
  const balanceEl = container.querySelector("#lot_balance");
  const entriesSubtotalEl = container.querySelector("#lot_entries_subtotal");
  const exitsSubtotalEl = container.querySelector("#lot_exits_subtotal");

  const ids = [
    "lot_starting_balance",
    "lot_scratch_10_am","lot_scratch_10_pm",
    "lot_draw_game_sales_am","lot_draw_game_sales_pm",
    "lot_cash_deposit_am","lot_cash_deposit_pm",
    "lot_draw_game_cashes_am","lot_draw_game_cashes_pm",
    "lot_draw_promo_plays_am","lot_draw_promo_plays_pm",
    "lot_draw_game_cancels_am","lot_draw_game_cancels_pm",
    "lot_instant_cashes_am","lot_instant_cashes_pm",
    "lot_to_deposit_am","lot_to_deposit_pm",
    "lot_refund_am","lot_refund_pm",
    "lot_cash_in_drawer"
  ];

  function setStatus(type, msg){
    statusEl.className = "status " + type;
    statusEl.textContent = msg;
    statusEl.classList.remove("hide");
  }

  function clearStatus(){
    statusEl.className = "status hide";
    statusEl.textContent = "";
  }

  function val(id){
    return toCents(container.querySelector("#" + id)?.value || "");
  }

  function calc(){
    const starting = val("lot_starting_balance");

    const entries =
      val("lot_scratch_10_am") +
      val("lot_scratch_10_pm") +
      val("lot_draw_game_sales_am") +
      val("lot_draw_game_sales_pm") +
      val("lot_cash_deposit_am") +
      val("lot_cash_deposit_pm");

    const exits =
      val("lot_draw_game_cashes_am") +
      val("lot_draw_game_cashes_pm") +
      val("lot_draw_promo_plays_am") +
      val("lot_draw_promo_plays_pm") +
      val("lot_draw_game_cancels_am") +
      val("lot_draw_game_cancels_pm") +
      val("lot_instant_cashes_am") +
      val("lot_instant_cashes_pm") +
      val("lot_to_deposit_am") +
      val("lot_to_deposit_pm") +
      val("lot_refund_am") +
      val("lot_refund_pm");

    const balance = starting + entries - exits;
    const cashInDrawer = val("lot_cash_in_drawer");

    entriesSubtotalEl.textContent = money(entries);
    exitsSubtotalEl.textContent = money(exits);
    balanceEl.value = centsToInput(balance);

    return { starting, entries, exits, balance, cashInDrawer };
  }

  ids.forEach((id) => {
    const el = container.querySelector("#" + id);
    if (!el) return;
    el.addEventListener("input", () => {
      calc();
      clearStatus();
    });
  });

  container.querySelector("#lot_clear").addEventListener("click", () => {
    form.reset();
    dateEl.value = todayISODate();
    balanceEl.value = "0.00";

    const fullName = [ctx?.profile?.first_name, ctx?.profile?.last_name].filter(Boolean).join(" ").trim();
    if (fullName) employeeEl.value = fullName;

    entriesSubtotalEl.textContent = money(0);
    exitsSubtotalEl.textContent = money(0);
    clearStatus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    if (!ctx?.user?.id) return setStatus("err", "❌ Not logged in.");

    const date = dateEl.value || todayISODate();
    const employee_name = employeeEl.value.trim();
    const notes = container.querySelector("#lot_notes").value.trim();

    if (!employee_name) return setStatus("err", "❌ Employee name is required.");

    const c = calc();

    const payload = {
      org_id: ctx.profile?.org_id ?? null,
      created_by: ctx.user.id,

      date,
      form_date: date,

      employee_name,
      starting_balance_cents: c.starting,

      scratch_10_am: val("lot_scratch_10_am"),
      scratch_10_pm: val("lot_scratch_10_pm"),

      draw_game_sales_am: val("lot_draw_game_sales_am"),
      draw_game_sales_pm: val("lot_draw_game_sales_pm"),

      cash_deposit_am: val("lot_cash_deposit_am"),
      cash_deposit_pm: val("lot_cash_deposit_pm"),

      draw_game_cashes_am: val("lot_draw_game_cashes_am"),
      draw_game_cashes_pm: val("lot_draw_game_cashes_pm"),

      draw_promo_plays_am: val("lot_draw_promo_plays_am"),
      draw_promo_plays_pm: val("lot_draw_promo_plays_pm"),

      draw_game_cancels_am: val("lot_draw_game_cancels_am"),
      draw_game_cancels_pm: val("lot_draw_game_cancels_pm"),

      instant_cashes_am: val("lot_instant_cashes_am"),
      instant_cashes_pm: val("lot_instant_cashes_pm"),

      to_deposit_am: val("lot_to_deposit_am"),
      to_deposit_pm: val("lot_to_deposit_pm"),

      refund_am: val("lot_refund_am"),
      refund_pm: val("lot_refund_pm"),

      cash_in_drawer_cents: c.cashInDrawer,
      balance_cents: c.balance,
      notes: notes || null
    };

    try {
      setStatus("ok", "Saving…");

      const { data, error } = await supabase
        .from("form_loteria")
        .insert(payload)
        .select("id, created_at")
        .single();

      if (error) throw error;

      setStatus("ok", `✅ Saved. Entry ID: ${data.id}`);
      window.dispatchEvent(new CustomEvent("forms:saved", { detail: { type:"loteria", id:data.id } }));
    } catch (err) {
      console.error(err);
      setStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
    }
  });

  dateEl.value = todayISODate();
  const fullName = [ctx?.profile?.first_name, ctx?.profile?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) employeeEl.value = fullName;
  calc();
}
