import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

function setStatus(el, type, msg) {
  el.className = "status " + type;
  el.textContent = msg;
  el.classList.remove("hide");
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

async function redirectIfLoggedIn() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    location.href = "/dashboard.html";
  }
}

bindTabs();
redirectIfLoggedIn();

$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const st = $("loginStatus");

  try {
    setStatus(st, "ok", "Logging in…");

    const email = $("loginEmail").value.trim();
    const password = $("loginPass").value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    setStatus(st, "err", "❌ Login failed: " + (err?.message || "Unknown error"));
  }
});

$("forgotBtn")?.addEventListener("click", async () => {
  const st = $("loginStatus");
  try {
    const email = $("loginEmail").value.trim();
    if (!email) throw new Error("Enter your email first.");
    setStatus(st, "ok", "Sending reset email…");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/"
    });
    if (error) throw error;
    setStatus(st, "ok", "✅ Reset email sent.");
  } catch (err) {
    console.error(err);
    setStatus(st, "err", "❌ " + (err?.message || "Could not send reset email"));
  }
});

$("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const st = $("signupStatus");

  try {
    const first_name = $("signupFirst").value.trim();
    const last_name = $("signupLast").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPass").value;

    if (!first_name || !last_name) throw new Error("First and last name required.");

    setStatus(st, "ok", "Creating account…");

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const user = data?.user;
    if (user?.id) {
      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email,
          first_name,
          last_name,
          role: "user"
        }, { onConflict: "id" });

      if (pErr) console.warn("Profile upsert warning:", pErr.message);
    }

    setStatus(st, "ok", "✅ Signup successful. Confirm your email if required, then login.");
  } catch (err) {
    console.error(err);
    setStatus(st, "err", "❌ Signup failed: " + (err?.message || "Unknown error"));
  }
});
