import { supabase } from "./supabaseClient.js";

const logoutBtn = document.getElementById("logoutBtn");
const adminStatus = document.getElementById("adminStatus");

const newOrgName = document.getElementById("newOrgName");
const createOrgBtn = document.getElementById("createOrgBtn");
const refreshOrgsBtn = document.getElementById("refreshOrgsBtn");
const orgsBody = document.getElementById("orgsBody");

const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const usersBody = document.getElementById("usersBody");

function setStatus(type, msg){
  adminStatus.className = "status " + type;
  adminStatus.textContent = msg;
}
function clearStatus(){
  adminStatus.className = "status";
  adminStatus.textContent = "";
}

async function requireAdmin(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) window.location.href = "/";

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", session.user.id)
    .single();

  if (error) throw error;
  if (profile.is_active === false) {
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  if (profile.role !== "admin") {
    alert("Admin only.");
    window.location.href = "/dashboard.html";
  }
}

function wireTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      document.getElementById("panel-orgs").classList.toggle("hide", key !== "orgs");
      document.getElementById("panel-users").classList.toggle("hide", key !== "users");
      clearStatus();
    });
  });
}

async function loadOrgs(){
  orgsBody.innerHTML = `<tr><td colspan="2" class="muted">Loading…</td></tr>`;
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,created_at")
    .order("name", { ascending: true });

  if (error) {
    orgsBody.innerHTML = `<tr><td colspan="2" class="muted">Error loading orgs</td></tr>`;
    setStatus("err", "❌ " + error.message);
    return [];
  }

  if (!data?.length) {
    orgsBody.innerHTML = `<tr><td colspan="2" class="muted">No orgs yet.</td></tr>`;
    return [];
  }

  orgsBody.innerHTML = data.map(o => `
    <tr>
      <td>${o.name}</td>
      <td class="small">${o.id}</td>
    </tr>
  `).join("");

  return data;
}

async function loadUsers(orgs){
  usersBody.innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,org_id,is_active,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    usersBody.innerHTML = `<tr><td colspan="5" class="muted">Error loading users</td></tr>`;
    setStatus("err", "❌ " + error.message);
    return;
  }

  const orgOptions = [`<option value="">(none)</option>`].concat(
    (orgs||[]).map(o => `<option value="${o.id}">${o.name}</option>`)
  ).join("");

  usersBody.innerHTML = (data || []).map(u => `
    <tr>
      <td>${u.email || "(no email)"}<div class="small">${u.id}</div></td>
      <td>
        <select data-u="${u.id}" data-f="role">
          <option value="user" ${u.role==="user"?"selected":""}>user</option>
          <option value="admin" ${u.role==="admin"?"selected":""}>admin</option>
        </select>
      </td>
      <td>
        <select data-u="${u.id}" data-f="org_id">${orgOptions}</select>
      </td>
      <td>
        <select data-u="${u.id}" data-f="is_active">
          <option value="true" ${u.is_active ? "selected":""}>true</option>
          <option value="false" ${u.is_active ? "":"selected"}>false</option>
        </select>
      </td>
      <td><button class="btn secondary" data-save="${u.id}" type="button">Save</button></td>
    </tr>
  `).join("");

  // set org selects value after render
  (data || []).forEach(u => {
    const sel = usersBody.querySelector(`select[data-u="${u.id}"][data-f="org_id"]`);
    if (sel) sel.value = u.org_id || "";
  });

  usersBody.querySelectorAll("button[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      clearStatus();
      const id = btn.dataset.save;

      const role = usersBody.querySelector(`select[data-u="${id}"][data-f="role"]`)?.value || "user";
      const org_id = usersBody.querySelector(`select[data-u="${id}"][data-f="org_id"]`)?.value || null;
      const is_active = (usersBody.querySelector(`select[data-u="${id}"][data-f="is_active"]`)?.value || "true") === "true";

      setStatus("ok", "Saving user…");
      const { error } = await supabase
        .from("profiles")
        .update({ role, org_id, is_active })
        .eq("id", id);

      if (error) return setStatus("err", "❌ " + error.message);
      setStatus("ok", "✅ User updated.");
    });
  });
}

createOrgBtn.addEventListener("click", async () => {
  clearStatus();
  const name = (newOrgName.value || "").trim();
  if (!name) return setStatus("err", "❌ Enter org name.");

  setStatus("ok", "Creating org…");
  const { error } = await supabase.from("organizations").insert({ name });

  if (error) return setStatus("err", "❌ " + error.message);
  setStatus("ok", "✅ Org created.");
  newOrgName.value = "";
  const orgs = await loadOrgs();
  await loadUsers(orgs);
});

refreshOrgsBtn.addEventListener("click", async () => {
  clearStatus();
  const orgs = await loadOrgs();
  await loadUsers(orgs);
});

refreshUsersBtn.addEventListener("click", async () => {
  clearStatus();
  const orgs = await loadOrgs();
  await loadUsers(orgs);
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
});

(async function init(){
  await requireAdmin();
  wireTabs();
  const orgs = await loadOrgs();
  await loadUsers(orgs);
})();
