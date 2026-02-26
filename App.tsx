import React from "react";

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, Segoe UI, Arial" }}>
      <h1>Compare Forms</h1>
      <p>Cloudflare Pages + Functions + Supabase</p>

      <div style={{ marginTop: 16 }}>
        <a href="/api/admin/create-org" style={{ marginRight: 12 }}>
          Test Function: create-org
        </a>
        <a href="/api/admin/create-user">Test Function: create-user</a>
      </div>

      <p style={{ marginTop: 24, opacity: 0.8 }}>
        Next: we’ll build the actual forms UI and connect to Supabase.
      </p>
    </div>
  );
}
