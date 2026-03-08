import { supabase } from "./supabase.js";

const adminWho = document.getElementById("adminWho");
const usersBody = document.getElementById("usersBody");
const adminStatus = document.getElementById("adminStatus");
const logoutBtn = document.getElementById("logoutBtn");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

function setStatus(type, msg) {
  adminStatus.className = "status " + type;
  adminStatus.textContent = msg;
  adminStatus.classList.remove("hide");
}

async function requireAdmin() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user;
  if (!user) {
    location.href = "/";
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  if (String(profile.role || "").toLowerCase() !== "admin") {
    location.href = "/dashboard.html";
    return null;
  }

  adminWho.textContent = `${profile.email} • ADMIN`;
  return user;
}

async function loadUsers() {
  usersBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, org_id")
    .order("email", { ascending: true });

  if (error) {
    usersBody.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    usersBody.innerHTML = `<tr><td colspan="6">No users found.</td></tr>`;
    return;
  }

  usersBody.innerHTML = data.map((u) => `
    <tr data-id="${esc(u.id)}">
      <td>${esc(u.email || "")}</td>
      <td><input id="f_${u.id}" value="${esc(u.first_name || "")}" /></td>
      <td><input id="l_${u.id}" value="${esc(u.last_name || "")}" /></td>
      <td>
        <select id="r_${u.id}">
          <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>
      <td><input id="o_${u.id}" value="${esc(u.org_id || "")}" /></td>
      <td><button class="btn secondary saveUserBtn" data-id="${esc(u.id)}" type="button">Save</button></td>
    </tr>
  `).join("");

  document.querySelectorAll(".saveUserBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      try {
        setStatus("ok", "Saving…");
        const first_name = document.getElementById(`f_${id}`).value.trim();
        const last_name = document.getElementById(`l_${id}`).value.trim();
        const role = document.getElementById(`r_${id}`).value;
        const org_id_raw = document.getElementById(`o_${id}`).value.trim();
        const org_id = org_id_raw || null;

        const { error: upErr } = await supabase
          .from("profiles")
          .update({ first_name, last_name, role, org_id })
          .eq("id", id);

        if (upErr) throw upErr;
        setStatus("ok", "✅ Saved.");
      } catch (err) {
        console.error(err);
        setStatus("err", "❌ Save failed: " + (err?.message || "Unknown error"));
      }
    });
  });
}

async function init() {
  const user = await requireAdmin();
  if (!user) return;
  await loadUsers();
}

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

init().catch((err) => {
  console.error(err);
  adminWho.textContent = "Error: " + (err?.message || "Unknown error");
});
