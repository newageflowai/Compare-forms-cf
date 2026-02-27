import { supabase } from "./supabase.js";

const whoami = document.getElementById("whoami");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

function setWho(msg) {
  if (whoami) whoami.textContent = msg;
}

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

async function loadProfileAndUI() {
  const session = await requireSession();
  if (!session) return;

  const user = session.user;

  // This query was failing due to the RLS recursion.
  // After the SQL fix, it will work.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (error) {
    setWho(`Error: ${error.message}`);
    console.error("profiles read error:", error);
    return;
  }

  const role = profile?.role || "user";
  const orgId = profile?.org_id || null;

  setWho(`${user.email} • ${role.toUpperCase()}${orgId ? " • Org: " + orgId : ""}`);

  // Show admin maintenance link only for admins
  if (role === "admin") {
    adminLink.style.display = "inline-flex";
  } else {
    adminLink.style.display = "none";
  }
}

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
});

await loadProfileAndUI();
