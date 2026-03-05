import { supabase } from "./supabase.js";
import { mountSafeForm } from "./forms/safe.js";

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
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts ?? "");
  }
}

let ctx = null; // { user, profile }

function bindTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");

      const key = t.dataset.tab;
      Object.values(panels).forEach((p) => p.classList.add("hide"));
      panels[key].classList.remove("hide");
    });
  });
}

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    location.href = "/";
    return null;
  }
  return data.session;
}

async function loadProfile(userId) {
  // NOTE: Your RLS previously caused recursion; you fixed it.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, org_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function fullName(profile) {
  const fn = (profile?.first_name || "").trim();
  const ln = (profile?.last_name || "").trim();
  const name = (fn + " " + ln).trim();
  return name || "User";
}

function showProfileModal() {
  const existing = document.getElementById("profileModalBackdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "profileModalBackdrop";
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,.55)";
  backdrop.style.display = "flex";
  backdrop.style.alignItems = "center";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "20px";
  backdrop.style.zIndex = "9999";

  const card = document.createElement("div");
  card.className = "card";
  card.style.maxWidth = "640px";
  card.style.width = "100%";

  card.innerHTML = `
    <div class="actions" style="justify-content:space-between;align-items:center">
      <div>
        <h2 style="margin:0">Profile</h2>
        <div class="muted">Update your first/last name.</div>
      </div>
      <button class="btn secondary" id="profileCloseBtn" type="button">Close</button>
    </div>

    <div style="height:10px"></div>

    <div class="grid2">
      <div>
        <label for="pf_first">First name</label>
        <input id="pf_first" type="text" value="${esc(ctx?.profile?.first_name || "")}" />
      </div>
      <div>
        <label for="pf_last">Last name</label>
        <input id="pf_last" type="text" value="${esc(ctx?.profile?.last_name || "")}" />
      </div>
    </div>

    <div class="actions" style="margin-top:12px">
      <button class="btn" id="profileSaveBtn" type="button">Save</button>
    </div>

    <div id="profileStatus" class="status" role="status" aria-live="polite"></div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  card.querySelector("#profileCloseBtn").addEventListener("click", close);

  card.querySelector("#profileSaveBtn").addEventListener("click", async () => {
    const st = card.querySelector("#profileStatus");
    st.className = "status";
    st.textContent = "";

    const first_name = card.querySelector("#pf_first").value.trim();
    const last_name = card.querySelector("#pf_last").value.trim();

    if (!first_name || !last_name) {
      st.className = "status err";
      st.textContent = "❌ First and last name required.";
      return;
    }

    try {
      st.className = "status ok";
      st.textContent = "Saving…";

      const { error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", ctx.user.id);

      if (error) throw error;

      // update local ctx + header
      ctx.profile.first_name = first_name;
      ctx.profile.last_name = last_name;
      whoami.textContent = `${ctx.profile.email} • ${fullName(ctx.profile)} • ${String(ctx.profile.role || "").toUpperCase()}`;

      st.className = "status ok";
      st.textContent = "✅ Saved.";
    } catch (err) {
      console.error(err);
      st.className = "status err";
      st.textContent = "❌ Save failed: " + (err?.message || "Unknown error");
    }
  });
}

async function loadRecentSafe() {
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  // IMPORTANT: your table currently uses column names: date, time (NOT form_date/form_time)
  const q = supabase
    .from("form_safe")
    .select("id, created_at, date, time, employee_name, notes, created_by, org_id")
    .order("created_at", { ascending: false })
    .limit(25);

  // If user is not admin, rely on RLS to restrict rows
  const { data, error } = await q;
  if (error) {
    recentBody.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
    return;
  }

  recentBody.innerHTML = data
    .map((r) => {
      return `
        <tr class="clickRow" data-type="safe" data-id="${esc(r.id)}" style="cursor:pointer">
          <td>${esc(fmtDT(r.created_at))}</td>
          <td>Safe</td>
          <td>${esc(r.date || "")}</td>
          <td>${esc(r.employee_name || "")}</td>
          <td>${esc((r.notes || "").slice(0, 40))}</td>
          <td class="mono">${esc(r.id)}</td>
        </tr>
      `;
    })
    .join("");

  recentBody.querySelectorAll(".clickRow").forEach((tr) => {
    tr.addEventListener("click", () => {
      openSafeEntryModal(tr.dataset.id);
    });
  });
}

function money(cents) {
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function int0(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

function toCents(v) {
  const x = Number(String(v || "").replace(/[$,]/g, ""));
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

function safeTotals(row) {
  const bills =
    int0(row.bills_100_qty) * 10000 +
    int0(row.bills_50_qty) * 5000 +
    int0(row.bills_20_qty) * 2000 +
    int0(row.bills_10_qty) * 1000 +
    int0(row.bills_5_qty) * 500 +
    int0(row.bills_1_qty) * 100;

  const regs = (row.reg1_amount_cents || 0) + (row.reg2_amount_cents || 0);
  const coins =
    int0(row.quarters_qty) * 25 +
    int0(row.dimes_qty) * 10 +
    int0(row.nickels_qty) * 5 +
    int0(row.pennies_qty) * 1;

  return { bills, regs, coins, total: bills + regs + coins };
}

async function openSafeEntryModal(id) {
  const existing = document.getElementById("entryModalBackdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "entryModalBackdrop";
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,.55)";
  backdrop.style.display = "flex";
  backdrop.style.alignItems = "center";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "20px";
  backdrop.style.zIndex = "9999";

  const card = document.createElement("div");
  card.className = "card";
  card.style.maxWidth = "980px";
  card.style.width = "100%";
  card.style.maxHeight = "85vh";
  card.style.overflow = "auto";

  card.innerHTML = `
    <div class="actions" style="justify-content:space-between;align-items:center">
      <div>
        <h2 style="margin:0">Safe Entry</h2>
        <div class="muted mono">${esc(id)}</div>
      </div>
      <div class="actions">
        <button class="btn secondary" id="entryCloseBtn" type="button">Close</button>
      </div>
    </div>
    <div id="entryBody" class="muted" style="margin-top:10px">Loading…</div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  card.querySelector("#entryCloseBtn").addEventListener("click", close);

  const entryBody = card.querySelector("#entryBody");

  const { data, error } = await supabase
    .from("form_safe")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    entryBody.innerHTML = `Error: ${esc(error.message)}`;
    return;
  }

  const isAdmin = String(ctx?.profile?.role || "").toLowerCase() === "admin";
  const t = safeTotals(data);

  entryBody.className = "";
  entryBody.innerHTML = `
    <div class="grid2">
      <div>
        <label>Date</label>
        <input id="v_date" type="date" value="${esc(data.date || "")}" ${isAdmin ? "" : "disabled"} />
      </div>
      <div>
        <label>Time</label>
        <input id="v_time" type="text" value="${esc(data.time || "")}" ${isAdmin ? "" : "disabled"} />
      </div>
    </div>

    <div style="margin-top:10px">
      <label>Employee Name</label>
      <input id="v_employee" type="text" value="${esc(data.employee_name || "")}" ${isAdmin ? "" : "disabled"} />
    </div>

    <div class="sectionTitle" style="margin-top:12px">Bills</div>
    <div class="grid2">
      <div><label>$100 qty</label><input id="v_b100" type="number" min="0" step="1" value="${esc(data.bills_100_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>$50 qty</label><input id="v_b50" type="number" min="0" step="1" value="${esc(data.bills_50_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>$20 qty</label><input id="v_b20" type="number" min="0" step="1" value="${esc(data.bills_20_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>$10 qty</label><input id="v_b10" type="number" min="0" step="1" value="${esc(data.bills_10_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>$5 qty</label><input id="v_b5" type="number" min="0" step="1" value="${esc(data.bills_5_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>$1 qty</label><input id="v_b1" type="number" min="0" step="1" value="${esc(data.bills_1_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
    </div>

    <div class="totalsRow" style="margin-top:8px">
      <div class="muted">Bills Subtotal</div>
      <div class="mono" id="v_bills_sub">${money(t.bills)}</div>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Registers</div>
    <div class="grid2">
      <div><label>Register 1</label><input id="v_reg1" type="text" value="${esc(((data.reg1_amount_cents||0)/100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Register 2</label><input id="v_reg2" type="text" value="${esc(((data.reg2_amount_cents||0)/100).toFixed(2))}" ${isAdmin ? "" : "disabled"} /></div>
    </div>
    <div class="totalsRow" style="margin-top:8px">
      <div class="muted">Registers Subtotal</div>
      <div class="mono" id="v_regs_sub">${money(t.regs)}</div>
    </div>

    <div class="sectionTitle" style="margin-top:12px">Coins</div>
    <div class="grid2">
      <div><label>Quarters qty</label><input id="v_q" type="number" min="0" step="1" value="${esc(data.quarters_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Dimes qty</label><input id="v_d" type="number" min="0" step="1" value="${esc(data.dimes_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Nickels qty</label><input id="v_n" type="number" min="0" step="1" value="${esc(data.nickels_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
      <div><label>Pennies qty</label><input id="v_p" type="number" min="0" step="1" value="${esc(data.pennies_qty ?? 0)}" ${isAdmin ? "" : "disabled"} /></div>
    </div>
    <div class="totalsRow" style="margin-top:8px">
      <div class="muted">Coins Subtotal</div>
      <div class="mono" id="v_coins_sub">${money(t.coins)}</div>
    </div>

    <div style="margin-top:12px">
      <label>Notes</label>
      <textarea id="v_notes" ${isAdmin ? "" : "disabled"}>${esc(data.notes || "")}</textarea>
    </div>

    <div class="totalsRow" style="margin-top:12px">
      <div style="font-weight:800">TOTAL</div>
      <div class="mono" id="v_total" style="font-weight:900">${money(t.total)}</div>
    </div>

    ${isAdmin ? `
      <div class="actions" style="margin-top:12px">
        <button class="btn" id="entrySaveBtn" type="button">Save Changes</button>
        <button class="btn secondary" id="entryDeleteBtn" type="button">Delete</button>
      </div>
    ` : ""}

    <div id="entryStatus" class="status" role="status" aria-live="polite"></div>
  `;

  // live total recalc
  function recalc() {
    const row = {
      bills_100_qty: int0(card.querySelector("#v_b100").value),
      bills_50_qty:  int0(card.querySelector("#v_b50").value),
      bills_20_qty:  int0(card.querySelector("#v_b20").value),
      bills_10_qty:  int0(card.querySelector("#v_b10").value),
      bills_5_qty:   int0(card.querySelector("#v_b5").value),
      bills_1_qty:   int0(card.querySelector("#v_b1").value),
      reg1_amount_cents: toCents(card.querySelector("#v_reg1").value),
      reg2_amount_cents: toCents(card.querySelector("#v_reg2").value),
      quarters_qty: int0(card.querySelector("#v_q").value),
      dimes_qty:    int0(card.querySelector("#v_d").value),
      nickels_qty:  int0(card.querySelector("#v_n").value),
      pennies_qty:  int0(card.querySelector("#v_p").value),
    };
    const tt = safeTotals(row);
    card.querySelector("#v_bills_sub").textContent = money(tt.bills);
    card.querySelector("#v_regs_sub").textContent = money(tt.regs);
    card.querySelector("#v_coins_sub").textContent = money(tt.coins);
    card.querySelector("#v_total").textContent = money(tt.total);
  }

  if (isAdmin) {
    card.querySelectorAll("input,textarea").forEach((el) => {
      el.addEventListener("input", recalc);
    });

    const entryStatus = card.querySelector("#entryStatus");
    const setEntryStatus = (type, msg) => {
      entryStatus.className = "status " + (type || "");
      entryStatus.textContent = msg || "";
    };

    card.querySelector("#entrySaveBtn")?.addEventListener("click", async () => {
      setEntryStatus("", "");
      try {
        setEntryStatus("ok", "Saving…");

        const payload = {
          date: card.querySelector("#v_date").value || null,
          time: card.querySelector("#v_time").value || null,
          employee_name: card.querySelector("#v_employee").value.trim(),
          bills_100_qty: int0(card.querySelector("#v_b100").value),
          bills_50_qty:  int0(card.querySelector("#v_b50").value),
          bills_20_qty:  int0(card.querySelector("#v_b20").value),
          bills_10_qty:  int0(card.querySelector("#v_b10").value),
          bills_5_qty:   int0(card.querySelector("#v_b5").value),
          bills_1_qty:   int0(card.querySelector("#v_b1").value),
          reg1_amount_cents: toCents(card.querySelector("#v_reg1").value),
          reg2_amount_cents: toCents(card.querySelector("#v_reg2").value),
          quarters_qty: int0(card.querySelector("#v_q").value),
          dimes_qty:    int0(card.querySelector("#v_d").value),
          nickels_qty:  int0(card.querySelector("#v_n").value),
          pennies_qty:  int0(card.querySelector("#v_p").value),
          notes: card.querySelector("#v_notes").value.trim() || null,
        };

        const { error: upErr } = await supabase
          .from("form_safe")
          .update(payload)
          .eq("id", id);

        if (upErr) throw upErr;

        setEntryStatus("ok", "✅ Saved.");
        await loadRecentSafe();
      } catch (err) {
        console.error(err);
        setEntryStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
      }
    });

    card.querySelector("#entryDeleteBtn")?.addEventListener("click", async () => {
      setEntryStatus("", "");
      if (!confirm("Delete this entry? This cannot be undone.")) return;
      try {
        setEntryStatus("ok", "Deleting…");
        const { error: delErr } = await supabase.from("form_safe").delete().eq("id", id);
        if (delErr) throw delErr;
        setEntryStatus("ok", "✅ Deleted.");
        await loadRecentSafe();
        setTimeout(close, 300);
      } catch (err) {
        console.error(err);
        setEntryStatus("err", "❌ Delete failed: " + (err?.message || "Unknown error"));
      }
    });
  }
}

async function init() {
  bindTabs();

  const session = await requireSession();
  if (!session) return;

  const user = session.user;
  const profile = await loadProfile(user.id);

  ctx = { user, profile };

  const role = String(profile?.role || "user").toUpperCase();
  whoami.textContent = `${profile.email} • ${fullName(profile)} • ${role}`;

  if (String(profile?.role || "").toLowerCase() === "admin") {
    adminLink.style.display = "";
  }

  // mount safe form
  mountSafeForm(panels.safe, ctx);

  // actions
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "/";
  });

  profileBtn.addEventListener("click", showProfileModal);

  refreshBtn.addEventListener("click", loadRecentSafe);

  window.addEventListener("forms:saved", () => loadRecentSafe());

  await loadRecentSafe();
}

init().catch((err) => {
  console.error(err);
  whoami.textContent = "Error: " + (err?.message || "Unknown error");
});
