import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

const $ = (id) => document.getElementById(id);

const whoami = $("whoami");
const logoutBtn = $("logoutBtn");
const adminLink = $("adminLink");
const profileBtn = $("profileBtn");
const refreshBtn = $("refreshBtn");
const recentBody = $("recentBody");

const panels = {
  safe: $("panel-safe"),
  loteria: $("panel-loteria"),
  cashpay: $("panel-cashpay"),
  transfer: $("panel-transfer"),
  daily: $("panel-daily"),
};

let ctx = { user: null, profile: null };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function show(el) {
  if (el) el.classList.remove("hide");
}

function hide(el) {
  if (el) el.classList.add("hide");
}

function fmtDateTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value ?? "");
  }
}

function fmtDate(value) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value ?? "");
  }
}

function int0(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

function toCents(v) {
  const x = Number(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

function money(cents) {
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fullName(profile) {
  const first = (profile?.first_name || "").trim();
  const last = (profile?.last_name || "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

function showPageError(message) {
  console.error(message);
  if (whoami) {
    whoami.textContent = "Error: " + message;
  }
  if (recentBody) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">${esc(message)}</td></tr>`;
  }
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const session = data?.session;
  if (!session?.user) {
    window.location.href = "/";
    return null;
  }
  return session;
}

async function loadProfile(userId) {
  // Keep this minimal and tolerant.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, org_id, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  // Return a safe default profile if row is missing
  return data || {
    id: userId,
    role: "user",
    org_id: null,
    first_name: "",
    last_name: "",
  };
}

function renderWhoAmI() {
  const name = fullName(ctx.profile);
  const role = String(ctx.profile?.role || "user").toUpperCase();
  const email = ctx.user?.email || "";
  whoami.textContent = `${email}${name ? " • " + name : ""} • ${role}`;
}

function bindTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        if (key === tab) show(panel);
        else hide(panel);
      });

      if (tab === "safe") {
        mountSafeForm(panels.safe, ctx);
      } else if (panels[tab]) {
        panels[tab].innerHTML = `<div class="muted">Form coming next…</div>`;
      }
    });
  });
}

function ensureModalShell() {
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
    .mono{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size:12px;
    }
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
    if (e.target === overlay) closeModal();
  });

  document.getElementById("entryModalClose").addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal() {
  ensureModalShell();
  document.getElementById("entryModalOverlay").style.display = "flex";
}

function closeModal() {
  const overlay = document.getElementById("entryModalOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
  document.getElementById("entryModalBody").innerHTML = "";
  const st = document.getElementById("entryModalStatus");
  st.className = "status";
  st.textContent = "";
}

function setModalStatus(type, msg) {
  const st = document.getElementById("entryModalStatus");
  st.className = "status " + (type || "");
  st.textContent = msg || "";
}

function calcBills(row) {
  return (
    int0(row.bills_100_qty) * 10000 +
    int0(row.bills_50_qty) * 5000 +
    int0(row.bills_20_qty) * 2000 +
    int0(row.bills_10_qty) * 1000 +
    int0(row.bills_5_qty) * 500 +
    int0(row.bills_1_qty) * 100
  );
}

function calcCoins(row) {
  return (
    int0(row.quarters_qty) * 25 +
    int0(row.dimes_qty) * 10 +
    int0(row.nickels_qty) * 5 +
    int0(row.pennies_qty) * 1
  );
}

function calcTotal(row) {
  return calcBills(row) + int0(row.reg1_amount_cents) + int0(row.reg2_amount_cents) + calcCoins(row);
}

function billRow(label, key, unitCents, data, isAdmin) {
  const qty = int0(data?.[key]);
  return `
    <tr>
      <td>${esc(label)}</td>
      <td><input id="m_${esc(key)}" type="number" min="0" step="1" value="${esc(qty)}" ${isAdmin ? "" : "disabled"} /></td>
      <td class="mono" id="m_amt_${esc(key)}">${money(qty * unitCents)}</td>
    </tr>
  `;
}

function coinRow(label, key, unitCents, data, isAdmin) {
  const qty = int0(data?.[key]);
  return `
    <tr>
      <td>${esc(label)}</td>
      <td><input id="m_${esc(key)}" type="number" min="0" step="1" value="${esc(qty)}" ${isAdmin ? "" : "disabled"} /></td>
      <td class="mono" id="m_amt_${esc(key)}">${money(qty * unitCents)}</td>
    </tr>
  `;
}

async function openProfileModal() {
  openModal();
  document.getElementById("entryModalTitle").textContent = "Profile";
  document.getElementById("entryModalSub").textContent = ctx?.user?.email || "";
  setModalStatus("", "");

  const body = document.getElementById("entryModalBody");
  body.innerHTML = `
    <div class="modalGrid2">
      <div>
        <label>First Name</label>
        <input id="p_first" type="text" value="${esc(ctx.profile?.first_name || "")}" />
      </div>
      <div>
        <label>Last Name</label>
        <input id="p_last" type="text" value="${esc(ctx.profile?.last_name || "")}" />
      </div>
    </div>

    <div class="miniNote">Update your display name on the dashboard.</div>

    <div class="actions" style="margin-top:12px; justify-content:flex-end;">
      <button class="btn" id="p_save" type="button">Save</button>
      <button class="btn secondary" id="p_close" type="button">Close</button>
    </div>
  `;

  body.querySelector("#p_close").addEventListener("click", closeModal);

  body.querySelector("#p_save").addEventListener("click", async () => {
    try {
      setModalStatus("ok", "Saving…");

      const first_name = (body.querySelector("#p_first").value || "").trim();
      const last_name = (body.querySelector("#p_last").value || "").trim();

      const { error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", ctx.user.id);

      if (error) throw error;

      ctx.profile.first_name = first_name;
      ctx.profile.last_name = last_name;
      renderWhoAmI();

      setModalStatus("ok", "✅ Profile saved.");
    } catch (err) {
      console.error(err);
      setModalStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
    }
  });
}

async function openSafeEntryModal(id) {
  openModal();
  document.getElementById("entryModalTitle").textContent = "Safe Entry";
  document.getElementById("entryModalSub").textContent = id;
  setModalStatus("", "");

  const body = document.getElementById("entryModalBody");
  body.innerHTML = `<div class="muted">Loading…</div>`;

  try {
    const { data, error } = await supabase
      .from("form_safe")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    const isAdmin = String(ctx.profile?.role || "").toLowerCase() === "admin";

    body.innerHTML = `
      <div class="modalGrid2">
        <div>
          <label>Date</label>
          <input id="m_date" type="date" value="${esc(data.date || "")}" ${isAdmin ? "" : "disabled"} />
        </div>
        <div>
          <label>Time</label>
          <input id="m_time" type="time" value="${esc(data.time || "")}" ${isAdmin ? "" : "disabled"} />
        </div>
      </div>

      <div style="margin-top:10px">
        <label>Employee Name</label>
        <input id="m_employee" type="text" value="${esc(data.employee_name || "")}" ${isAdmin ? "" : "disabled"} />
      </div>

      <div class="hr"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div class="pill">Bills</div>
        <div class="mono" id="m_bills_sub">${money(calcBills(data))}</div>
      </div>
      <div style="overflow:auto;margin-top:8px;">
        <table>
          <thead>
            <tr><th>Denomination</th><th style="width:160px;">Qty</th><th>Amount</th></tr>
          </thead>
          <tbody class="rowTight">
            ${billRow("$100", "bills_100_qty", 10000, data, isAdmin)}
            ${billRow("$50", "bills_50_qty", 5000, data, isAdmin)}
            ${billRow("$20", "bills_20_qty", 2000, data, isAdmin)}
            ${billRow("$10", "bills_10_qty", 1000, data, isAdmin)}
            ${billRow("$5", "bills_5_qty", 500, data, isAdmin)}
            ${billRow("$1", "bills_1_qty", 100, data, isAdmin)}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div class="pill">Registers</div>
        <div class="mono" id="m_regs_sub">${money(int0(data.reg1_amount_cents) + int0(data.reg2_amount_cents))}</div>
      </div>
      <div class="modalGrid2" style="margin-top:8px;">
        <div>
          <label>Register 1</label>
          <input id="m_reg1" type="text" value="${esc(((int0(data.reg1_amount_cents)) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} />
        </div>
        <div>
          <label>Register 2</label>
          <input id="m_reg2" type="text" value="${esc(((int0(data.reg2_amount_cents)) / 100).toFixed(2))}" ${isAdmin ? "" : "disabled"} />
        </div>
      </div>

      <div class="hr"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div class="pill">Coins</div>
        <div class="mono" id="m_coins_sub">${money(calcCoins(data))}</div>
      </div>
      <div style="overflow:auto;margin-top:8px;">
        <table>
          <thead>
            <tr><th>Coin</th><th style="width:160px;">Qty</th><th>Amount</th></tr>
          </thead>
          <tbody class="rowTight">
            ${coinRow("Quarters", "quarters_qty", 25, data, isAdmin)}
            ${coinRow("Dimes", "dimes_qty", 10, data, isAdmin)}
            ${coinRow("Nickels", "nickels_qty", 5, data, isAdmin)}
            ${coinRow("Pennies", "pennies_qty", 1, data, isAdmin)}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <label>Notes</label>
      <textarea id="m_notes" ${isAdmin ? "" : "disabled"}>${esc(data.notes || "")}</textarea>

      <div class="kv">
        <b>TOTAL</b>
        <b class="mono" id="m_total">${money(calcTotal(data))}</b>
      </div>

      <div class="actions" style="margin-top:12px;justify-content:space-between;">
        <div>
          ${isAdmin ? `<button class="btn danger" id="entryDeleteBtn" type="button">Delete</button>` : ``}
        </div>
        <div style="display:flex;gap:10px;">
          ${isAdmin ? `<button class="btn" id="entrySaveBtn" type="button">Save Changes</button>` : ``}
          <button class="btn secondary" id="entryCloseBtn2" type="button">Close</button>
        </div>
      </div>
    `;

    body.querySelector("#entryCloseBtn2").addEventListener("click", closeModal);

    const recalc = () => {
      const row = {
        bills_100_qty: int0(body.querySelector("#m_bills_100_qty")?.value),
        bills_50_qty: int0(body.querySelector("#m_bills_50_qty")?.value),
        bills_20_qty: int0(body.querySelector("#m_bills_20_qty")?.value),
        bills_10_qty: int0(body.querySelector("#m_bills_10_qty")?.value),
        bills_5_qty: int0(body.querySelector("#m_bills_5_qty")?.value),
        bills_1_qty: int0(body.querySelector("#m_bills_1_qty")?.value),
        reg1_amount_cents: toCents(body.querySelector("#m_reg1")?.value),
        reg2_amount_cents: toCents(body.querySelector("#m_reg2")?.value),
        quarters_qty: int0(body.querySelector("#m_quarters_qty")?.value),
        dimes_qty: int0(body.querySelector("#m_dimes_qty")?.value),
        nickels_qty: int0(body.querySelector("#m_nickels_qty")?.value),
        pennies_qty: int0(body.querySelector("#m_pennies_qty")?.value),
      };

      body.querySelector("#m_bills_sub").textContent = money(calcBills(row));
      body.querySelector("#m_regs_sub").textContent = money(int0(row.reg1_amount_cents) + int0(row.reg2_amount_cents));
      body.querySelector("#m_coins_sub").textContent = money(calcCoins(row));
      body.querySelector("#m_total").textContent = money(calcTotal(row));

      const billDefs = [
        ["bills_100_qty", 10000],
        ["bills_50_qty", 5000],
        ["bills_20_qty", 2000],
        ["bills_10_qty", 1000],
        ["bills_5_qty", 500],
        ["bills_1_qty", 100],
      ];
      billDefs.forEach(([key, cents]) => {
        const cell = body.querySelector(`#m_amt_${key}`);
        if (cell) cell.textContent = money(int0(row[key]) * cents);
      });

      const coinDefs = [
        ["quarters_qty", 25],
        ["dimes_qty", 10],
        ["nickels_qty", 5],
        ["pennies_qty", 1],
      ];
      coinDefs.forEach(([key, cents]) => {
        const cell = body.querySelector(`#m_amt_${key}`);
        if (cell) cell.textContent = money(int0(row[key]) * cents);
      });
    };

    if (isAdmin) {
      body.querySelectorAll("input,textarea").forEach((el) => el.addEventListener("input", recalc));

      body.querySelector("#entrySaveBtn").addEventListener("click", async () => {
        try {
          setModalStatus("ok", "Saving…");

          const payload = {
            date: body.querySelector("#m_date").value || null,
            time: body.querySelector("#m_time").value || null,
            employee_name: body.querySelector("#m_employee").value.trim() || null,
            bills_100_qty: int0(body.querySelector("#m_bills_100_qty").value),
            bills_50_qty: int0(body.querySelector("#m_bills_50_qty").value),
            bills_20_qty: int0(body.querySelector("#m_bills_20_qty").value),
            bills_10_qty: int0(body.querySelector("#m_bills_10_qty").value),
            bills_5_qty: int0(body.querySelector("#m_bills_5_qty").value),
            bills_1_qty: int0(body.querySelector("#m_bills_1_qty").value),
            reg1_amount_cents: toCents(body.querySelector("#m_reg1").value),
            reg2_amount_cents: toCents(body.querySelector("#m_reg2").value),
            quarters_qty: int0(body.querySelector("#m_quarters_qty").value),
            dimes_qty: int0(body.querySelector("#m_dimes_qty").value),
            nickels_qty: int0(body.querySelector("#m_nickels_qty").value),
            pennies_qty: int0(body.querySelector("#m_pennies_qty").value),
            notes: body.querySelector("#m_notes").value.trim() || null,
          };

          const { error: upErr } = await supabase
            .from("form_safe")
            .update(payload)
            .eq("id", id);

          if (upErr) throw upErr;

          setModalStatus("ok", "✅ Saved.");
          await loadRecentSafe();
        } catch (err) {
          console.error(err);
          setModalStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
        }
      });

      body.querySelector("#entryDeleteBtn").addEventListener("click", async () => {
        try {
          if (!confirm("Delete this entry? This cannot be undone.")) return;
          setModalStatus("ok", "Deleting…");

          const { error: delErr } = await supabase
            .from("form_safe")
            .delete()
            .eq("id", id);

          if (delErr) throw delErr;

          setModalStatus("ok", "✅ Deleted.");
          await loadRecentSafe();
          setTimeout(closeModal, 250);
        } catch (err) {
          console.error(err);
          setModalStatus("err", "❌ Delete failed: " + (err?.message || "Unknown error"));
        }
      });
    }
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="muted">Error: ${esc(err?.message || "Could not load entry")}</div>`;
  }
}

async function loadRecentSafe() {
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    let q = supabase
      .from("form_safe")
      .select("id, created_at, date, time, employee_name, notes, created_by, org_id")
      .order("created_at", { ascending: false })
      .limit(25);

    if (String(ctx.profile?.role || "").toLowerCase() !== "admin" && ctx.profile?.org_id) {
      q = q.eq("org_id", ctx.profile.org_id);
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data?.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
      return;
    }

    recentBody.innerHTML = data.map((r) => `
      <tr class="clickRow" data-id="${esc(r.id)}" style="cursor:pointer">
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>Safe</td>
        <td>${esc(fmtDate(r.date))}</td>
        <td>${esc(r.employee_name || "")}</td>
        <td>${esc((r.notes || "").slice(0, 40))}</td>
        <td class="mono">${esc(r.id)}</td>
      </tr>
    `).join("");

    recentBody.querySelectorAll(".clickRow").forEach((tr) => {
      tr.addEventListener("click", () => openSafeEntryModal(tr.dataset.id));
    });
  } catch (err) {
    console.error(err);
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err?.message || "Unknown error")}</td></tr>`;
  }
}

async function init() {
  try {
    const session = await requireSession();
    if (!session) return;

    ctx.user = session.user;
    ctx.profile = await loadProfile(session.user.id);

    renderWhoAmI();

    if (String(ctx.profile?.role || "").toLowerCase() === "admin") {
      adminLink.style.display = "";
    }

    bindTabs();
    mountSafeForm(panels.safe, ctx);

    profileBtn?.addEventListener("click", openProfileModal);

    logoutBtn?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    });

    refreshBtn?.addEventListener("click", loadRecentSafe);
    window.addEventListener("forms:saved", loadRecentSafe);

    await loadRecentSafe();
  } catch (err) {
    console.error(err);
    showPageError(err?.message || "Dashboard failed to load.");
  }
}

init();
