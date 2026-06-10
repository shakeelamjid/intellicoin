"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Chain = { key: string; label: string; address: string };
type Invoice = { invoiceId: string; plan: string; chainKey: string; chainLabel: string; address: string; amount: string; expiresAt: string };

export default function BuyPage() {
  const [pricing, setPricing] = useState<any>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [plan, setPlan] = useState<"DAY" | "MONTH">("DAY");
  const [chainKey, setChainKey] = useState("");
  const [email, setEmail] = useState("");
  const [inv, setInv] = useState<Invoice | null>(null);
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pricing").then((r) => r.json()).then(setPricing);
    fetch("/api/chains").then((r) => r.json()).then((d) => { setChains(d.chains); if (d.chains[0]) setChainKey(d.chains[0].key); });
  }, []);

  async function createInvoice() {
    setBusy(true); setErr("");
    const r = await fetch("/api/invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, chainKey, email }) });
    setBusy(false);
    if (r.ok) setInv(await r.json()); else setErr((await r.json()).error || "Could not create invoice");
  }
  async function verify() {
    if (!inv) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/invoice/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: inv.invoiceId, txHash: tx.trim() }) });
    setBusy(false);
    if (r.ok) setDone(true); else setErr((await r.json()).error || "Verification failed");
  }

  if (done) return (
    <main className="wrap" style={{ maxWidth: 520 }}>
      <p className="eyebrow">Payment verified</p>
      <h1 style={{ fontSize: "2rem" }}>You&rsquo;re in.</h1>
      <p className="lede">Your {inv?.plan === "MONTH" ? "monthly" : "day"} pass is active. Scans are unlocked.</p>
      <a className="cta" href="/" style={{ display: "inline-block", marginTop: 18 }}>Back to the scanner →</a>
    </main>
  );

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <p className="eyebrow">Upgrade</p>
      <h1 style={{ fontSize: "2rem" }}>Buy a pass</h1>
      <p className="lede">Pay in USDT to unlock unlimited scans. Pick a plan and chain, send the exact amount, paste the transaction hash — verified on-chain.</p>

      {!inv ? (
        <div className="card stack" style={{ marginTop: 22 }}>
          <div>
            <p className="label">Plan</p>
            <div className="seg">
              <button className={plan === "DAY" ? "on" : ""} onClick={() => setPlan("DAY")}>Day pass · {pricing?.dayPassPrice ?? "…"} USDT</button>
              <button className={plan === "MONTH" ? "on" : ""} onClick={() => setPlan("MONTH")}>Monthly · {pricing?.monthPassPrice ?? "…"} USDT</button>
            </div>
          </div>
          <div>
            <p className="label">Pay with</p>
            <div className="chips">
              {chains.length === 0 && <span style={{ color: "var(--tx3)", fontSize: ".88rem" }}>No payment chains enabled yet.</span>}
              {chains.map((c) => (
                <button key={c.key} className={`chip ${chainKey === c.key ? "on" : ""}`} onClick={() => setChainKey(c.key)}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Email (for your receipt)</p>
            <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-body)" }} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <span style={{ color: "var(--down)", fontSize: ".85rem" }}>{err}</span>}
          <button className="cta btn-block" onClick={createInvoice} disabled={busy || !chainKey}>{busy ? "Creating…" : "Continue to payment →"}</button>
        </div>
      ) : (
        <div className="card stack" style={{ marginTop: 22 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ background: "#fff", padding: 10, borderRadius: 12 }}>
              <QRCodeSVG value={inv.address} size={132} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="label" style={{ marginBottom: 4 }}>Send exactly</p>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: "1.4rem", color: "var(--cyan)" }}>{inv.amount} USDT</div>
              <p className="label" style={{ margin: "12px 0 4px" }}>{inv.chainLabel} · to</p>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: ".8rem", color: "var(--tx2)", wordBreak: "break-all" }}>{inv.address}</div>
            </div>
          </div>
          <p style={{ color: "var(--tx3)", fontSize: ".84rem", margin: 0 }}>
            Send the <b style={{ color: "var(--tx)" }}>exact</b> amount (the extra decimals identify your payment), then paste the transaction hash below.
          </p>
          <div>
            <p className="label">Transaction hash</p>
            <input className="ta" style={{ minHeight: 0, fontFamily: "var(--f-mono)" }} placeholder="paste tx hash / reference" value={tx} onChange={(e) => setTx(e.target.value)} />
          </div>
          {err && <span style={{ color: "var(--down)", fontSize: ".85rem" }}>{err}</span>}
          <button className="cta btn-block" onClick={verify} disabled={busy || !tx.trim()}>{busy ? "Verifying on-chain…" : "I've paid — verify"}</button>
          <button className="ghost btn-block" onClick={() => { setInv(null); setTx(""); setErr(""); }}>Start over</button>
        </div>
      )}
    </main>
  );
}
