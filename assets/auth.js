import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

function setStatus(el, type, msg) {
  el.className = "status " + (type || "");
  el.textContent = msg || "";
}

function bindTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");

      const key = t.dataset.tab;
      document.querySelectorAll(".panel").forEach((p) => p.classList.add("hide"));
      document.getElementById(`panel-${key}`).classList.remove("hide");
    });
  });
}

async function goDashboardIfLoggedIn() {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    location.href = "/dashboard.html";
  }
}

bindTabs();
goDashboardIfLoggedIn();

// LOGIN
const loginForm = $("loginForm");
const authStatus = $("authStatus");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(authStatus, "", "");

  const email = $("loginEmail").value.trim();
  const password = $("loginPass").value;

  try {
    setStatus(authStatus, "ok", "Logging in…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "err", "❌ Login failed: " + (err?.message || "Unknown error"));
  }
});

// SIGNUP
const signupForm = $("signupForm");
const signupStatus = $("signupStatus");

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(signupStatus, "", "");

  const first_name = $("signupFirst").value.trim();
  const last_name  = $("signupLast").value.trim();
  const email      = $("signupEmail").value.trim();
  const password   = $("signupPass").value;

  if (!first_name || !last_name) {
    return setStatus(signupStatus, "err", "❌ First and last name required.");
  }

  try {
    setStatus(signupStatus, "ok", "Creating account…");

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // If session exists immediately, write profile now. If not, they must confirm email first.
    const user = data?.user;
    if (user?.id) {
      // Insert/Upsert profile row
      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email,
          first_name,
          last_name,
          role: "user"
        }, { onConflict: "id" });

      if (pErr) {
        console.warn("Profile upsert failed:", pErr);
      }
    }

    setStatus(signupStatus, "ok", "✅ Signup successful. If email confirmation is on, check your inbox. Then login.");
  } catch (err) {
    console.error(err);
    setStatus(signupStatus, "err", "❌ Signup failed: " + (err?.message || "Unknown error"));
  }
});
