import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";
import { mountLoteriaForm } from "./forms/loteria.js";

const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const profileBtn = document.getElementById("profileBtn");
const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");

const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

function fmtDT(ts) {
  try { return new Date(ts).toLocaleString(); }
  catch { return String(ts ?? ""); }
}

function int0(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

function toCents(v) {
  const x = Number(String(v || "").replace(/[$,]/g, ""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

function money(cents) {
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

let ctx = null;

function fullName(profile) {
  const fn = (profile?.first_name || "").trim();
  const ln = (profile?.last_name || "").trim();
  return (fn + " " + ln).trim() || "User";
}

function setTabs(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  Object.entries(panels).forEach(([key, panel]) => {
    if (!panel) return;
    if (key === tabName) panel.classList.remove("hide");
    else panel.classList.add("hide");
  });

  if (tabName === "safe") {
    mountSafeForm(panels.safe, ctx);
  } else if (tabName === "loteria") {
    mountLoteriaForm(panels.loteria, ctx);
  }
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setTabs(tab.dataset.tab));
  });
}

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session?.user) {
    location.href = "/";
    return null;
  }
  return data.session;
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, org_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function ensureModalShell() {
  if (document.getElementById("entryModalBackdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "entryModalBackdrop";
  backdrop.className = "modalOverlay hide";
  backdrop.innerHTML = `
    <div class="modalCard">
      <div class="modalTop">
        <div>
          <h3 id="entryModalTitle">Modal</h3>
          <div class="modalSub mono" id="entryModalSub"></div>
        </div>
        <div class="actions">
          <button class="btn secondary" id="entryModalClose" type="button">Close</button>
        </div>
      </div>
      <div id="entryModalBody"></div>
      <div id="entryModalStatus" class="status hide" role="status" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  backdrop.querySelector("#entryModalClose").addEventListener("click", closeModal);
}

function openModal(title, sub = "") {
  ensureModalShell();
  const backdrop = document.getElementById("entryModalBackdrop");
  backdrop.classList.remove("hide");
  document.getElementById("entryModalTitle").textContent = title;
  document.getElementById("entryModalSub").textContent = sub;
  document.getElementById("entryModalBody").innerHTML = "";
  const st = document.getElementById("entryModalStatus");
  st.className = "status hide";
  st.textContent = "";
}

function closeModal() {
  const backdrop = document.getElementById("entryModalBackdrop");
  if (backdrop) backdrop.classList.add("hide");
}

function setModalStatus(type, msg) {
  const st = document.getElementById("entryModalStatus");
  st.className = "status " + type;
  st.textContent = msg;
  st.classList.remove("hide");
}

function showProfileModal() {
  openModal("Profile", ctx.user.email);

  const body = document.getElementById("entryModalBody");
  body.innerHTML = `
    <div class="grid2">
      <div>
        <label for="pf_first">First name</label>
        <input id="pf_first" value="${esc(ctx.profile.first_name || "")}" />
      </div>
      <div>
        <label for="pf_last">Last name</label>
        <input id="pf_last" value="${esc(ctx.profile.last_name || "")}" />
      </div>
    </div>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="profileSaveBtn" type="button">Save</button>
    </div>
  `;

  body.querySelector("#profileSaveBtn").addEventListener("click", async () => {
    try {
      const first_name = body.querySelector("#pf_first").value.trim();
      const last_name = body.querySelector("#pf_last").value.trim();

      setModalStatus("ok", "Saving…");

      const { error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", ctx.user.id);

      if (error) throw error;

      ctx.profile.first_name = first_name;
      ctx.profile.last_name = last_name;
      whoami.textContent = `${ctx.profile.email} • ${fullName(ctx.profile)} • ${String(ctx.profile.role || "").toUpperCase()}`;
      setModalStatus("ok", "✅ Saved.");
    } catch (err) {
      console.error(err);
      setModalStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
    }
  });
}

function loteriaCalc(row) {
  const entries =
    int0(row.scratch_10_am) +
    int0(row.scratch_10_pm) +
    int0(row.draw_game_sales_am) +
    int0(row.draw_game_sales_pm) +
    int0(row.cash_deposit_am) +
    int0(row.cash_deposit_pm);

  const exits =
    int0(row.draw_game_cashes_am) +
    int0(row.draw_game_cashes_pm) +
    int0(row.draw_promo_plays_am) +
    int0(row.draw_promo_plays_pm) +
    int0(row.draw_game_cancels_am) +
    int0(row.draw_game_cancels_pm) +
    int0(row.instant_cashes_am) +
    int0(row.instant_cashes_pm) +
    int0(row.to_deposit_am) +
    int0(row.to_deposit_pm) +
    int0(row.refund_am) +
    int0(row.refund_pm);

  const starting = int0(row.starting_balance_cents);
  const balance = starting + entries - exits;
  return { entries, exits, balance };
}

async function openSafeEntryModal(id) {
  const { data, error } = await supabase
    .from("form_safe")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    openModal("Safe Entry", id);
    document.getElementById("entryModalBody").innerHTML = `<div class="muted">Error: ${esc(error.message)}</div>`;
    return;
  }

  const isAdmin = String(ctx.profile.role || "").toLowerCase() === "admin";

  const bills =
    int0(data.bills_100_qty) * 10000 +
    int0(data.bills_50_qty) * 5000 +
    int0(data.bills_20_qty) * 2000 +
    int0(data.bills_10_qty) * 1000 +
    int0(data.bills_5_qty) * 500 +
    int0(data.bills_1_qty) * 100;

  const regs = int0(data.reg1_amount_cents) + int0(data.reg2_amount_cents);
  const coins =
    int0(data.quarters_qty) * 25 +
    int0(data.dimes_qty) * 10 +
    int0(data.nickels_qty) * 5 +
    int0(data.pennies_qty) * 1;

  openModal("Safe Entry", id);

  const body = document.getElementById("entryModalBody");
  body.innerHTML = `
    <div class="grid2">
      <div><label>Date</label><input id="m_date" type="date" value="${esc(data.date || "")}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Time</label><input id="m_time" value="${esc(data.time || "")}" ${isAdmin ? "" : "disabled"} /></div>
    </div>

    <div style="margin-top:10px">
      <label>Employee Name</label>
      <input id="m_employee" value="${esc(data.employee_name || "")}" ${isAdmin ? "" : "disabled"} />
    </div>

    <div class="sectionTitle">Bills Total</div>
    <div class="mono">${money(bills)}</div>

    <div class="sectionTitle">Registers Total</div>
    <div class="mono">${money(regs)}</div>

    <div class="sectionTitle">Coins Total</div>
    <div class="mono">${money(coins)}</div>

    <div class="sectionTitle">Notes</div>
    <textarea id="m_notes" ${isAdmin ? "" : "disabled"}>${esc(data.notes || "")}</textarea>

    <div class="totalsRow">
      <div style="font-weight:800">TOTAL</div>
      <div class="mono" style="font-weight:900">${money(bills + regs + coins)}</div>
    </div>

    ${isAdmin ? `
      <div class="actions" style="margin-top:12px">
        <button class="btn" id="entrySaveBtn" type="button">Save Changes</button>
        <button class="btn secondary danger" id="entryDeleteBtn" type="button">Delete</button>
      </div>
    ` : ""}
  `;

  if (isAdmin) {
    body.querySelector("#entrySaveBtn").addEventListener("click", async () => {
      try {
        setModalStatus("ok", "Saving…");
        const payload = {
          date: body.querySelector("#m_date").value || null,
          time: body.querySelector("#m_time").value || null,
          employee_name: body.querySelector("#m_employee").value.trim() || null,
          notes: body.querySelector("#m_notes").value.trim() || null
        };

        const { error: upErr } = await supabase.from("form_safe").update(payload).eq("id", id);
        if (upErr) throw upErr;

        setModalStatus("ok", "✅ Saved.");
        await loadRecentEntries();
      } catch (err) {
        console.error(err);
        setModalStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
      }
    });

    body.querySelector("#entryDeleteBtn").addEventListener("click", async () => {
      if (!confirm("Delete this entry?")) return;
      try {
        setModalStatus("ok", "Deleting…");
        const { error: delErr } = await supabase.from("form_safe").delete().eq("id", id);
        if (delErr) throw delErr;
        setModalStatus("ok", "✅ Deleted.");
        await loadRecentEntries();
        setTimeout(closeModal, 250);
      } catch (err) {
        console.error(err);
        setModalStatus("err", "❌ Delete failed: " + (err?.message || "Unknown error"));
      }
    });
  }
}

async function openLoteriaEntryModal(id) {
  const { data, error } = await supabase
    .from("form_loteria")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    openModal("Lotería Entry", id);
    document.getElementById("entryModalBody").innerHTML = `<div class="muted">Error: ${esc(error.message)}</div>`;
    return;
  }

  const isAdmin = String(ctx.profile.role || "").toLowerCase() === "admin";
  const totals = loteriaCalc(data);

  openModal("Cuadre de Lotería", id);

  const body = document.getElementById("entryModalBody");
  body.innerHTML = `
    <div class="grid2">
      <div><label>Date</label><input id="l_date" type="date" value="${esc(data.date || "")}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Employee Name</label><input id="l_employee" value="${esc(data.employee_name || "")}" ${isAdmin ? "" : "disabled"} /></div>
    </div>

    <div class="sectionTitle">Starting Balance</div>
    <input id="l_starting_balance" value="${esc(((data.starting_balance_cents || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} />

    <div class="sectionTitle">Entradas</div>
    <div class="grid2">
      <div><label>Scratch $10 AM</label><input id="l_scratch_10_am" value="${esc(((data.scratch_10_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Scratch $10 PM</label><input id="l_scratch_10_pm" value="${esc(((data.scratch_10_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Draw Game Sales AM</label><input id="l_draw_game_sales_am" value="${esc(((data.draw_game_sales_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Draw Game Sales PM</label><input id="l_draw_game_sales_pm" value="${esc(((data.draw_game_sales_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Cash Deposit AM</label><input id="l_cash_deposit_am" value="${esc(((data.cash_deposit_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Cash Deposit PM</label><input id="l_cash_deposit_pm" value="${esc(((data.cash_deposit_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
    </div>

    <div class="totalsRow">
      <div class="muted">Entradas Subtotal</div>
      <div class="mono">${money(totals.entries)}</div>
    </div>

    <div class="sectionTitle">Salidas</div>
    <div class="grid2">
      <div><label>Draw Game Cashes AM</label><input id="l_draw_game_cashes_am" value="${esc(((data.draw_game_cashes_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Draw Game Cashes PM</label><input id="l_draw_game_cashes_pm" value="${esc(((data.draw_game_cashes_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Draw Promo Plays AM</label><input id="l_draw_promo_plays_am" value="${esc(((data.draw_promo_plays_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Draw Promo Plays PM</label><input id="l_draw_promo_plays_pm" value="${esc(((data.draw_promo_plays_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Draw Game Cancels AM</label><input id="l_draw_game_cancels_am" value="${esc(((data.draw_game_cancels_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Draw Game Cancels PM</label><input id="l_draw_game_cancels_pm" value="${esc(((data.draw_game_cancels_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Instant Cashes AM</label><input id="l_instant_cashes_am" value="${esc(((data.instant_cashes_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Instant Cashes PM</label><input id="l_instant_cashes_pm" value="${esc(((data.instant_cashes_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>To Deposit AM</label><input id="l_to_deposit_am" value="${esc(((data.to_deposit_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>To Deposit PM</label><input id="l_to_deposit_pm" value="${esc(((data.to_deposit_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>

      <div><label>Refund AM</label><input id="l_refund_am" value="${esc(((data.refund_am || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Refund PM</label><input id="l_refund_pm" value="${esc(((data.refund_pm || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
    </div>

    <div class="totalsRow">
      <div class="muted">Salidas Subtotal</div>
      <div class="mono">${money(totals.exits)}</div>
    </div>

    <div class="sectionTitle">Drawer / Balance</div>
    <div class="grid2">
      <div><label>Cash in Drawer</label><input id="l_cash_in_drawer" value="${esc(((data.cash_in_drawer_cents || 0) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Calculated Balance</label><input id="l_balance" value="${esc(((data.balance_cents || 0) / 100).toFixed(2))}" disabled /></div>
    </div>

    <label for="l_notes">Notes</label>
    <textarea id="l_notes" ${isAdmin ? "" : "disabled"}>${esc(data.notes || "")}</textarea>

    ${isAdmin ? `
      <div class="actions" style="margin-top:12px">
        <button class="btn" id="l_saveBtn" type="button">Save Changes</button>
        <button class="btn secondary danger" id="l_deleteBtn" type="button">Delete</button>
      </div>
    ` : ""}
  `;

  function recalcLoteriaInModal() {
    const row = {
      starting_balance_cents: toCents(body.querySelector("#l_starting_balance").value),
      scratch_10_am: toCents(body.querySelector("#l_scratch_10_am").value),
      scratch_10_pm: toCents(body.querySelector("#l_scratch_10_pm").value),
      draw_game_sales_am: toCents(body.querySelector("#l_draw_game_sales_am").value),
      draw_game_sales_pm: toCents(body.querySelector("#l_draw_game_sales_pm").value),
      cash_deposit_am: toCents(body.querySelector("#l_cash_deposit_am").value),
      cash_deposit_pm: toCents(body.querySelector("#l_cash_deposit_pm").value),

      draw_game_cashes_am: toCents(body.querySelector("#l_draw_game_cashes_am").value),
      draw_game_cashes_pm: toCents(body.querySelector("#l_draw_game_cashes_pm").value),
      draw_promo_plays_am: toCents(body.querySelector("#l_draw_promo_plays_am").value),
      draw_promo_plays_pm: toCents(body.querySelector("#l_draw_promo_plays_pm").value),
      draw_game_cancels_am: toCents(body.querySelector("#l_draw_game_cancels_am").value),
      draw_game_cancels_pm: toCents(body.querySelector("#l_draw_game_cancels_pm").value),
      instant_cashes_am: toCents(body.querySelector("#l_instant_cashes_am").value),
      instant_cashes_pm: toCents(body.querySelector("#l_instant_cashes_pm").value),
      to_deposit_am: toCents(body.querySelector("#l_to_deposit_am").value),
      to_deposit_pm: toCents(body.querySelector("#l_to_deposit_pm").value),
      refund_am: toCents(body.querySelector("#l_refund_am").value),
      refund_pm: toCents(body.querySelector("#l_refund_pm").value),
    };

    const totals = loteriaCalc(row);
    body.querySelector("#l_balance").value = (totals.balance / 100).toFixed(2);
  }

  if (isAdmin) {
    body.querySelectorAll("input,textarea").forEach((el) => {
      el.addEventListener("input", recalcLoteriaInModal);
    });

    body.querySelector("#l_saveBtn").addEventListener("click", async () => {
      try {
        setModalStatus("ok", "Saving…");

        const payload = {
          date: body.querySelector("#l_date").value || null,
          employee_name: body.querySelector("#l_employee").value.trim() || null,

          starting_balance_cents: toCents(body.querySelector("#l_starting_balance").value),

          scratch_10_am: toCents(body.querySelector("#l_scratch_10_am").value),
          scratch_10_pm: toCents(body.querySelector("#l_scratch_10_pm").value),

          draw_game_sales_am: toCents(body.querySelector("#l_draw_game_sales_am").value),
          draw_game_sales_pm: toCents(body.querySelector("#l_draw_game_sales_pm").value),

          cash_deposit_am: toCents(body.querySelector("#l_cash_deposit_am").value),
          cash_deposit_pm: toCents(body.querySelector("#l_cash_deposit_pm").value),

          draw_game_cashes_am: toCents(body.querySelector("#l_draw_game_cashes_am").value),
          draw_game_cashes_pm: toCents(body.querySelector("#l_draw_game_cashes_pm").value),

          draw_promo_plays_am: toCents(body.querySelector("#l_draw_promo_plays_am").value),
          draw_promo_plays_pm: toCents(body.querySelector("#l_draw_promo_plays_pm").value),

          draw_game_cancels_am: toCents(body.querySelector("#l_draw_game_cancels_am").value),
          draw_game_cancels_pm: toCents(body.querySelector("#l_draw_game_cancels_pm").value),

          instant_cashes_am: toCents(body.querySelector("#l_instant_cashes_am").value),
          instant_cashes_pm: toCents(body.querySelector("#l_instant_cashes_pm").value),

          to_deposit_am: toCents(body.querySelector("#l_to_deposit_am").value),
          to_deposit_pm: toCents(body.querySelector("#l_to_deposit_pm").value),

          refund_am: toCents(body.querySelector("#l_refund_am").value),
          refund_pm: toCents(body.querySelector("#l_refund_pm").value),

          cash_in_drawer_cents: toCents(body.querySelector("#l_cash_in_drawer").value),
          balance_cents: toCents(body.querySelector("#l_balance").value),
          notes: body.querySelector("#l_notes").value.trim() || null,
        };

        const { error: upErr } = await supabase.from("form_loteria").update(payload).eq("id", id);
        if (upErr) throw upErr;

        setModalStatus("ok", "✅ Saved.");
        await loadRecentEntries();
      } catch (err) {
        console.error(err);
        setModalStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
      }
    });

    body.querySelector("#l_deleteBtn").addEventListener("click", async () => {
      if (!confirm("Delete this Lotería entry?")) return;
      try {
        setModalStatus("ok", "Deleting…");
        const { error: delErr } = await supabase.from("form_loteria").delete().eq("id", id);
        if (delErr) throw delErr;
        setModalStatus("ok", "✅ Deleted.");
        await loadRecentEntries();
        setTimeout(closeModal, 250);
      } catch (err) {
        console.error(err);
        setModalStatus("err", "❌ Delete failed: " + (err?.message || "Unknown error"));
      }
    });
  }
}

async function loadRecentEntries() {
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    const safeQ = supabase
      .from("form_safe")
      .select("id, created_at, date, employee_name, notes, org_id");

    const lotQ = supabase
      .from("form_loteria")
      .select("id, created_at, date, employee_name, notes, org_id");

    let safeQuery = safeQ;
    let lotQuery = lotQ;

    if (String(ctx.profile.role || "").toLowerCase() !== "admin" && ctx.profile.org_id) {
      safeQuery = safeQuery.eq("org_id", ctx.profile.org_id);
      lotQuery = lotQuery.eq("org_id", ctx.profile.org_id);
    }

    const [{ data: safeRows, error: safeErr }, { data: lotRows, error: lotErr }] = await Promise.all([
      safeQuery,
      lotQuery
    ]);

    if (safeErr) throw safeErr;
    if (lotErr) throw lotErr;

    const allRows = [
      ...(safeRows || []).map(r => ({ ...r, form_type: "safe" })),
      ...(lotRows || []).map(r => ({ ...r, form_type: "loteria" }))
    ];

    allRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!allRows.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = allRows.slice(0, 25).map((r) => `
      <tr class="rowLink" data-type="${esc(r.form_type)}" data-id="${esc(r.id)}" style="cursor:pointer">
        <td>${esc(fmtDT(r.created_at))}</td>
        <td>${r.form_type === "safe" ? "Safe" : "Lotería"}</td>
        <td>${esc(r.date || "")}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 40))}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    recentBody.querySelectorAll(".rowLink").forEach((tr) => {
      tr.addEventListener("click", () => {
        const type = tr.dataset.type;
        const id = tr.dataset.id;
        if (type === "safe") openSafeEntryModal(id);
        if (type === "loteria") openLoteriaEntryModal(id);
      });
    });
  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err?.message || "Unknown error")}</td></tr>`;
  }
}

async function init() {
  try {
    bindTabs();

    const session = await requireSession();
    if (!session) return;

    const user = session.user;
    const profile = await loadProfile(user.id);

    ctx = { user, profile };

    whoami.textContent = `${profile.email} • ${fullName(profile)} • ${String(profile.role || "").toUpperCase()}`;

    if (String(profile.role || "").toLowerCase() === "admin") {
      adminLink.classList.remove("hide");
    }

    setTabs("safe");

    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      location.href = "/";
    });

    profileBtn.addEventListener("click", showProfileModal);
    refreshBtn.addEventListener("click", loadRecentEntries);
    window.addEventListener("forms:saved", () => loadRecentEntries());

    await loadRecentEntries();
  } catch (err) {
    console.error(err);
    whoami.textContent = "Error: " + (err?.message || "Unknown error");
  }
}

init();
