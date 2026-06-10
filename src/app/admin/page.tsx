"use client";
import { useEffect, useState } from "react";

type Settings = {
  free_scan_limit: number; free_code_limit: number; day_pass_price: string; month_pass_price: string;
  confirmations_required: number; invoice_expiry_minutes: number; scan_universe_default: number; scan_universe_max: number;
};
type Chain = { key: string; label: string; address: string; explorer_api_key: string; enabled: boolean };

export default function AdminPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [ov, setOv] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const [a, b, c] = await Promise.all([
      fetch("/api/admin/settings"), fetch("/api/admin/chains"), fetch("/api/admin/overview"),
    ]);
    if (a.status === 401) { location.href = "/admin/login"; return; }
    setS(await a.json()); setChains((await b.json()).chains); setOv(await c.json());
  }
  useEffect(() => { load(); }, []);

  async function saveSettings() {
    setMsg("");
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setMsg(r.ok ? "Saved." : "Save failed."); if (r.ok) setS(await r.json());
  }
  async function saveChains() {
    setMsg("");
    const r = await fetch("/api/admin/chains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chains }) });
    setMsg(r.ok ? "Chains saved." : "Save failed."); if (r.ok) setChains((await r.json()).chains);
  }
  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); location.href = "/admin/login"; }

  if (!s) return <main className="wrap"><p className="lede">Loading…</p></main>;
  const upd = (k: keyof Settings, v: string) => setS({ ...s, [k]: v } as Settings);

  return (
    <main className="wrap stack">
      <div style={{ display: "flex", alignItems: "center" }}>
        <div><p className="eyebrow">Admin panel</p><h1 style={{ fontSize: "2rem", margin: 0 }}>Controls</h1></div>
        <button className="ghost" style={{ marginLeft: "auto" }} onClick={logout}>Sign out</button>
      </div>

      {ov && (
        <div className="how" style={{ marginTop: 0 }}>
          <div className="step"><h4 style={{ fontSize: "1.6rem", color: "var(--cyan)" }}>{ov.activePasses}</h4><p>Active passes</p></div>
          <div className="step"><h4 style={{ fontSize: "1.6rem", color: "var(--cyan)" }}>{ov.paidInvoices}</h4><p>Paid invoices</p></div>
          <div className="step"><h4 style={{ fontSize: "1.6rem", color: "var(--cyan)" }}>{ov.pendingInvoices}</h4><p>Pending invoices</p></div>
        </div>
      )}

      <div className="card">
        <h3>Pricing &amp; free limits</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginTop: 14 }}>
          {([
            ["Free scans / day", "free_scan_limit"],
            ["Free scripts", "free_code_limit"],
            ["Day pass (USDT)", "day_pass_price"],
            ["Monthly (USDT)", "month_pass_price"],
            ["Confirmations required", "confirmations_required"],
            ["Invoice expiry (min)", "invoice_expiry_minutes"],
            ["Scan universe (default)", "scan_universe_default"],
            ["Scan universe (max)", "scan_universe_max"],
          ] as [string, keyof Settings][]).map(([label, k]) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="label" style={{ margin: 0 }}>{label}</span>
              <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-mono)" }} value={String(s[k])} onChange={(e) => upd(k, e.target.value)} />
            </label>
          ))}
        </div>
        <button className="cta" style={{ marginTop: 16 }} onClick={saveSettings}>Save settings</button>
      </div>

      <div className="card">
        <h3>Payment chains &amp; addresses</h3>
        <p className="sub">Set your receiving address per chain and enable the ones you accept. Users see the address + QR for whichever they pick.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {chains.map((c, i) => (
            <div key={c.key} className="card" style={{ background: "var(--panel2)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <strong style={{ fontFamily: "var(--f-display)" }}>{c.label}</strong>
                <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: ".82rem", color: "var(--tx3)" }}>
                  <input type="checkbox" checked={c.enabled} onChange={(e) => { const n = [...chains]; n[i] = { ...c, enabled: e.target.checked }; setChains(n); }} /> enabled
                </label>
              </div>
              <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-mono)", marginBottom: 8 }} placeholder="Receiving address" value={c.address} onChange={(e) => { const n = [...chains]; n[i] = { ...c, address: e.target.value }; setChains(n); }} />
              <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-mono)" }} placeholder="Explorer API key (optional, for live verification)" value={c.explorer_api_key} onChange={(e) => { const n = [...chains]; n[i] = { ...c, explorer_api_key: e.target.value }; setChains(n); }} />
            </div>
          ))}
        </div>
        <button className="cta" style={{ marginTop: 16 }} onClick={saveChains}>Save chains</button>
      </div>

      {msg && <p style={{ color: "var(--up)", fontSize: ".88rem" }}>{msg}</p>}
    </main>
  );
}
