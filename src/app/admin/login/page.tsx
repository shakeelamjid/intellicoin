"use client";
import { useState } from "react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    setBusy(false);
    if (r.ok) location.href = "/admin";
    else setErr((await r.json().catch(() => ({}))).error || "Login failed");
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <p className="eyebrow">Admin</p>
      <h1 style={{ fontSize: "1.8rem" }}>Sign in</h1>
      <div className="card" style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-body)" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-body)" }} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <span style={{ color: "var(--down)", fontSize: ".85rem" }}>{err}</span>}
        <button className="cta btn-block" onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </div>
    </main>
  );
}
