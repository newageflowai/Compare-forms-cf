import { supabase } from "./supabaseClient.js";

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const forgotBtn = document.getElementById("forgotBtn");
const statusEl = document.getElementById("status");

function setStatus(type, msg){
  statusEl.className = "status " + type;
  statusEl.textContent = msg;
}
function clearStatus(){
  statusEl.className = "status";
  statusEl.textContent = "";
}

async function goIfLoggedIn(){
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) window.location.href = "/dashboard.html";
}

await goIfLoggedIn();

loginBtn.addEventListener("click", async () => {
  clearStatus();
  const email = emailEl.value.trim();
  const password = passEl.value.trim();
  if (!email || !password) return setStatus("err", "❌ Enter email + password.");

  setStatus("ok", "Logging in…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return setStatus("err", "❌ " + error.message);

  setStatus("ok", "✅ Logged in. Redirecting…");
  window.location.href = "/dashboard.html";
});

signupBtn.addEventListener("click", async () => {
  clearStatus();
  const email = emailEl.value.trim();
  const password = passEl.value.trim();
  if (!email || !password) return setStatus("err", "❌ Enter email + password.");

  setStatus("ok", "Creating account…");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + "/dashboard.html" }
  });

  if (error) return setStatus("err", "❌ " + error.message);
  setStatus("ok", "✅ Account created. If email confirmation is on, check your inbox.");
});

forgotBtn.addEventListener("click", async () => {
  clearStatus();
  const email = emailEl.value.trim();
  if (!email) return setStatus("err", "❌ Enter your email first.");

  setStatus("ok", "Sending reset email…");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/"
  });

  if (error) return setStatus("err", "❌ " + error.message);
  setStatus("ok", "✅ Reset email sent (check inbox/spam).");
});
