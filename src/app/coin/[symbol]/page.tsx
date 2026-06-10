type Params = { params: Promise<{ symbol: string }> };

export default async function CoinPage({ params }: Params) {
  const { symbol } = await params;
  const reads: Array<{ l: string; v: string; ok: boolean }> = [
    { l: "Signal — crossover + RSI>50", v: "fired · 4h close 16:00", ok: true },
    { l: "Higher timeframe — same setup on 1D", v: "aligned", ok: true },
    { l: "BTC regime — BTC above 200 EMA", v: "risk-on", ok: true },
    { l: "Correlation to BTC — 30d rolling", v: "ρ 0.81", ok: true },
  ];

  return (
    <main className="wrap stack">
      <div className="page-head">
        <p className="eyebrow">Coin read</p>
        <h1 style={{ fontFamily: "var(--f-mono)" }}>{symbol}</h1>
        <p className="lede">Why it passed — not just that it did.</p>
      </div>

      <div className="card">
        <h3>Chart</h3>
        <p className="sub">Your indicator on {symbol} at the scan timeframe, trigger bar marked.</p>
        <div style={{ height: 260, border: "1px solid var(--line)", borderRadius: 12, display: "grid", placeItems: "center", color: "var(--tx4)", fontFamily: "var(--f-mono)", fontSize: ".82rem" }}>
          chart mounts here (lightweight-charts)
        </div>
      </div>

      <div className="card">
        <h3>Why it passed</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {reads.map((r) => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: ".92rem", color: "var(--tx2)" }}>{r.l}</span>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: ".82rem", color: r.ok ? "var(--up)" : "var(--down)" }}>
                {r.v} {r.ok ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
