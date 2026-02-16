import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { dollarsToCents } from "../../lib/money";

export default function SafeForm() {
  const { profile, user } = useAuth();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [q100, setQ100] = useState(0);
  const [q50, setQ50] = useState(0);
  const [q20, setQ20] = useState(0);
  const [q10, setQ10] = useState(0);
  const [q5, setQ5] = useState(0);
  const [q1, setQ1] = useState(0);

  const [reg1, setReg1] = useState("0");
  const [reg2, setReg2] = useState("0");

  const [quarters, setQuarters] = useState(0);
  const [dimes, setDimes] = useState(0);
  const [nickels, setNickels] = useState(0);
  const [pennies, setPennies] = useState(0);

  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    if (!profile?.org_id) return setMsg("Your user is not assigned to an organization.");
    if (!date) return setMsg("Date is required.");

    const { error } = await supabase.from("form_safe").insert({
      org_id: profile.org_id,
      created_by: user.id,
      date,
      time,
      employee_name: employeeName,
      bills_100_qty: q100,
      bills_50_qty: q50,
      bills_20_qty: q20,
      bills_10_qty: q10,
      bills_5_qty: q5,
      bills_1_qty: q1,
      reg1_amount_cents: dollarsToCents(reg1),
      reg2_amount_cents: dollarsToCents(reg2),
      quarters_qty: quarters,
      dimes_qty: dimes,
      nickels_qty: nickels,
      pennies_qty: pennies
    });

    if (error) setMsg(error.message);
    else setMsg("Saved ✅");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h2>Cuadre del Safe</h2>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, 1fr)" }}>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Time <input value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label>Name <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} /></label>
      </div>

      <h3>Billetes</h3>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, 1fr)" }}>
        <label>$100 qty <input type="number" value={q100} onChange={(e) => setQ100(+e.target.value)} /></label>
        <label>$50 qty <input type="number" value={q50} onChange={(e) => setQ50(+e.target.value)} /></label>
        <label>$20 qty <input type="number" value={q20} onChange={(e) => setQ20(+e.target.value)} /></label>
        <label>$10 qty <input type="number" value={q10} onChange={(e) => setQ10(+e.target.value)} /></label>
        <label>$5 qty <input type="number" value={q5} onChange={(e) => setQ5(+e.target.value)} /></label>
        <label>$1 qty <input type="number" value={q1} onChange={(e) => setQ1(+e.target.value)} /></label>
      </div>

      <h3>Cash Registers</h3>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, 1fr)" }}>
        <label>Register 1 ($) <input value={reg1} onChange={(e) => setReg1(e.target.value)} /></label>
        <label>Register 2 ($) <input value={reg2} onChange={(e) => setReg2(e.target.value)} /></label>
      </div>

      <h3>Monedas</h3>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label>Quarters qty <input type="number" value={quarters} onChange={(e) => setQuarters(+e.target.value)} /></label>
        <label>Dimes qty <input type="number" value={dimes} onChange={(e) => setDimes(+e.target.value)} /></label>
        <label>Nickels qty <input type="number" value={nickels} onChange={(e) => setNickels(+e.target.value)} /></label>
        <label>Pennies qty <input type="number" value={pennies} onChange={(e) => setPennies(+e.target.value)} /></label>
      </div>

      <button onClick={save} style={{ marginTop: 12 }}>Save</button>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
