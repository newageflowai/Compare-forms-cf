import { supabase } from "./supabase.js";

/* =========================
   Elements
========================= */
const whoami = document.getElementById("whoami");

const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");
const profileBtn = document.getElementById("profileBtn");

const refreshBtn = document.getElementById("refreshBtn");
const recentBody = document.getElementById("recentBody");
const recentStatus = document.getElementById("recentStatus");

const formStatus = document.getElementById("formStatus");

// Tabs/panels (placeholders for now)
const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
const panels = {
  safe: document.getElementById("panel-safe"),
  loteria: document.getElementById("panel-loteria"),
  cashpay: document.getElementById("panel-cashpay"),
  transfer: document.getElementById("panel-transfer"),
  daily: document.getElementById("panel-daily"),
};

// Profile modal elements
const profileOverlay = document.getElementById("profileOverlay");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileStatus = document.getElementById("profileStatus");
const profileFirst = document.getElementById("profileFirst");
const profileLast = document.getElementById("profileLast");

/* =========================
   Helpers
========================= */
function showEl(el){ el?.classList.remove("hide"); }
function hideEl(el){ el?.classList.add("hide"); }

function setStatus(el, type, msg){
  if (!el) return;
  el.className = "status " + type; // ok | err
  el.textContent = msg;
}
function clearStatus(el){
  if (!el) return;
  el.className = "status";
  el.textContent = "";
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

function fmtDateTime(iso){
  try { return new Date(iso).toLocaleString(); } catch { return String(iso || ""); }
}

/* =========================
   State
========================= */
let currentUser = null;
let currentRole = "user"; // user | admin
let currentOrgId = null;
let currentProfile = { first_name: "", last_name: "" };

/* =========================
   Tabs UI (placeholder)
========================= */
function setActiveTab(tabKey){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabKey));
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    if (k === tabKey) el.classList.remove("hide");
    else el.classList.add("hide");
  });
}

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab);
  });
});

// Add placeholder content (until we wire forms)
panels.safe.innerHTML = `<div class="muted">Safe form coming next…</div>`;
panels.loteria.innerHTML = `<div class="muted">Lotería form coming next…</div>`;
panels.cashpay.innerHTML = `<div class="muted">Cash Payment form coming next…</div>`;
panels.transfer.innerHTML = `<div class="muted">Transfer / Shrinkage form coming next…</div>`;
panels.daily.innerHTML = `<div class="muted">Cuadre Diario form coming next…</div>`;

/* =========================
   Auth Guard
========================= */
async function requireSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    // If you have a login page, send them there
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

/* =========================
   Load Profile (role/org/name)
========================= */
async function loadMyProfile(){
  const session = await requireSession();
  if (!session) return;

  currentUser = session.user;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, org_id, first_name, last_name")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
    setStatus(formStatus, "err", "❌ " + error.message);
    return;
  }

  currentRole = (data?.role || "user").toLowerCase();
  currentOrgId = data?.org_id || null;
  currentProfile.first_name = data?.first_name || "";
  currentProfile.last_name  = data?.last_name || "";

  // Admin button visibility
  if (currentRole === "admin") adminLink.style.display = "";
  else adminLink.style.display = "none";

  const fullName = `${currentProfile.first_name || ""} ${currentProfile.last_name || ""}`.trim();
  const namePart = fullName ? ` • ${fullName}` : "";
  whoami.textContent = `${currentUser.email}${namePart} • ${currentRole.toUpperCase()}`;
}

/* =========================
   Profile Modal
========================= */
function openProfileModal(){
  clearStatus(profileStatus);

  profileFirst.value = currentProfile.first_name || "";
  profileLast.value = currentProfile.last_name || "";

  showEl(profileOverlay);
  profileOverlay.setAttribute("aria-hidden", "false");
}

function closeProfileModal(){
  hideEl(profileOverlay);
  profileOverlay.setAttribute("aria-hidden", "true");
  clearStatus(profileStatus);
}

profileBtn?.addEventListener("click", openProfileModal);
closeProfileBtn?.addEventListener("click", closeProfileModal);
cancelProfileBtn?.addEventListener("click", closeProfileModal);

profileOverlay?.addEventListener("click", (e) => {
  if (e.target === profileOverlay) closeProfileModal();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && profileOverlay && !profileOverlay.classList.contains("hide")) {
    closeProfileModal();
  }
});

saveProfileBtn?.addEventListener("click", async () => {
  clearStatus(profileStatus);

  const first_name = (profileFirst.value || "").trim();
  const last_name  = (profileLast.value || "").trim();

  if (!first_name || !last_name) {
    return setStatus(profileStatus, "err", "❌ Enter first and last name.");
  }

  const session = await requireSession();
  if (!session) return;

  saveProfileBtn.disabled = true;
  setStatus(profileStatus, "ok", "Saving…");

  const { error } = await supabase
    .from("profiles")
    .update({ first_name, last_name })
    .eq("id", session.user.id);

  saveProfileBtn.disabled = false;

  if (error) {
    console.error(error);
    return setStatus(profileStatus, "err", "❌ Save failed: " + error.message);
  }

  currentProfile.first_name = first_name;
  currentProfile.last_name = last_name;

  // Refresh header label
  const fullName = `${first_name} ${last_name}`.trim();
  whoami.textContent = `${session.user.email} • ${fullName} • ${currentRole.toUpperCase()}`;

  setStatus(profileStatus, "ok", "✅ Saved.");
  setTimeout(closeProfileModal, 600);
});

/* =========================
   Recent Entries (placeholder)
   (We’ll wire this up once forms are finished)
========================= */
async function loadRecent(){
  clearStatus(recentStatus);
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  // For now, just show empty message
  // (Next step: query form_safe/form_loteria/etc by org_id and combine)
  recentBody.innerHTML = `<tr><td colspan="6" class="muted">No entries yet.</td></tr>`;
}

refreshBtn?.addEventListener("click", loadRecent);

/* =========================
   Logout
========================= */
logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
});

/* =========================
   Init
========================= */
(async function init(){
  await loadMyProfile();
  await loadRecent();
})();
