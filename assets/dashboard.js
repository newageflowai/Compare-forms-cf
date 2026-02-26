import { supabase } from "./supabaseClient.js";
import {
  renderSafe, renderLoteria, renderCashPayment, renderTransfer, renderDaily,
  submitHandlers, setStatus, clearStatus
} from "./forms.js";

const whoEl = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const statusEl = document.getElementById("formStatus");
const recentBody = document.getElementById("recentBody");
const refreshBtn = document.getElementById("refreshBtn");

function show(el){ el.classList.remove("hide"); }
function hide(el){ el.classList.add("hide"); }

async function requireSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) window.location.href = "/";
  return session.user;
}

async function loadProfile(userId){
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,org_id,is_active")
    .eq("id", userId)
    .single();

  if (error) throw error;
  if (data.is_active === false) {
    await supabase.auth.signOut();
    alert("Account disabled. Contact admin.");
    window.location.href = "/";
  }
  return data;
}

function wireTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");

      const key = btn.getAttribute("data-tab");
      document.querySelectorAll(".panel").forEach(p => p.classList.add("hide"));
      document.getElementById(`panel-${key}`).classList.remove("hide");
      clearStatus(statusEl);
    });
  });
}

async function loadRecent(profile){
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  // Pull small recent sets from each table and merge client-side
  const tables = [
    { name: "form_safe", type: "SAFE", dateField: "form_date", empField: "employee_name", notesField: "notes" },
    { name: "form_loteria", type: "LOTERIA", dateField: "form_date", empField: "employee_name", notesField: "notes" },
    { name: "form_cash_payment", type: "CASHPAY", dateField: "pay_date", empField: "given_to", notesField: "reason" },
    { name: "form_transfer", type: "TRANSFER", dateField: "transfer_date", empField: "description", notesField: "dept_from" },
    { name: "form_daily", type: "DAILY", dateField: "form_date", empField: "responsible", notesField: "notes" },
  ];

  const results = [];

  for (const t of tables) {
    let q = supabase.from(t.name)
      .select(`id, created_at, ${t.dateField}, ${t.empField}, ${t.notesField}, org_id`)
      .order("created_at", { ascending: false })
      .limit(10);

    // org filter is enforced by RLS already; but we can also filter if user has org set
    if (profile.role !== "admin" && profile.org_id) q = q.eq("org_id", profile.org_id);

    const { data, error } = await q;
    if (!error && data) {
      data.forEach(r => results.push({
        id: r.id,
        created_at: r.created_at,
        type: t.type,
        date: r[t.dateField] || "",
        employee: r[t.empField] || "",
        notes: r[t.notesField] || ""
      }));
    }
  }

  results.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const top = results.slice(0, 25);

  if (!top.length) {
    recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
    return;
  }

  recentBody.innerHTML = top.map(r => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${r.type}</td>
      <td>${r.date || ""}</td>
      <td>${String(r.employee || "").slice(0, 40)}</td>
      <td>${String(r.notes || "").slice(0, 60)}</td>
      <td class="small">${r.id.slice(0,8)}…</td>
    </tr>
  `).join("");
}

(async function init(){
  const user = await requireSession();
  const profile = await loadProfile(user.id);

  whoEl.textContent = `${profile.email} • role=${profile.role} • org=${profile.org_id ? profile.org_id.slice(0,8)+"…" : "(none)"}`;

  if (profile.role === "admin") adminLink.style.display = "inline-flex";

  // If no org assigned, block form submits (common on fresh signup)
  if (!profile.org_id && profile.role !== "admin") {
    setStatus(statusEl, "err", "❌ No organization assigned. Ask admin to assign your org in Admin → Users.");
  }

  // Render panels
  renderSafe(document.getElementById("panel-safe"));
  renderLoteria(document.getElementById("panel-loteria"));
  renderCashPayment(document.getElementById("panel-cashpay"));
  renderTransfer(document.getElementById("panel-transfer"));
  renderDaily(document.getElementById("panel-daily"));

  wireTabs();

  // Wire submit handlers
  await submitHandlers({ profile, statusEl });

  // Recent
  await loadRecent(profile);

  refreshBtn.addEventListener("click", () => loadRecent(profile));

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  });

  supabase.auth.onAuthStateChange((_evt, session) => {
    if (!session?.user) window.location.href = "/";
  });
})();
