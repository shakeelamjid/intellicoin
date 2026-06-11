"use client";
import { useEffect, useState } from "react";

const TF_TO_TV: Record<string, string> = { "1m":"1","3m":"3","5m":"5","15m":"15","30m":"30","1h":"60","2h":"120","4h":"240","6h":"360","12h":"720","1D":"D","3D":"3D","1W":"W" };

export default function CoinView({ symbol, tf, bias }: { symbol: string; tf: string; bias: "long" | "short" }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ctx: any = {};
    try { ctx = JSON.parse(sessionStorage.getItem("ic_ctx") || "{}"); } catch {}
    const expr = bias === "short" ? ctx.short : ctx.long;
    fetch("/api/coin-analysis", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, tf, exchange: ctx.exchange || "Binance", code: ctx.code, expr }),
    }).then((r) => r.json()).then(setData).catch((e) => setErr(String(e)));
  }, [symbol, tf, bias]);

  const interval = TF_TO_TV[tf] || "240";
  const tvSrc = `https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A${encodeURIComponent(symbol)}&interval=${interval}&theme=dark&style=1&hidesidetoolbar=1&hidetoptoolbar=0&saveimage=0&locale=en`;

  return (
    <main className="wrap stack">
      <div className="page-head">
        <p className="eyebrow">{bias === "short" ? "Short-biased" : "Long-biased"} · {tf}</p>
        <h1 style={{ fontFamily: "var(--f-mono)" }}>{symbol}</h1>
      </div>

      {/* TradingView chart */}
      <div className="card" style={{ padding: 8 }}>
        <iframe src={tvSrc} style={{ width: "100%", height: 440, border: 0, borderRadius: 12 }} allowFullScreen title={`${symbol} chart`} />
      </div>

      {/* free stats */}
      <div className="card">
        <h3>Market read</h3>
        {!data && !err && <p className="sub">Loading…</p>}
        {err && <p className="sub" style={{ color: "var(--down)" }}>{err}</p>}
        {data?.stats && (
          <div className="statgrid">
            <div className="stat"><span className="sl">Price</span><span className="sv">{data.stats.price}</span></div>
            <div className="stat"><span className="sl">RSI(14)</span><span className="sv">{data.stats.rsi14}</span></div>
            <div className="stat"><span className="sl">vs EMA20</span><span className={`sv ${data.stats.aboveEma20 ? "up" : "down"}`}>{data.stats.aboveEma20 ? "above" : "below"}</span></div>
            <div className="stat"><span className="sl">vs EMA50</span><span className={`sv ${data.stats.aboveEma50 ? "up" : "down"}`}>{data.stats.aboveEma50 ? "above" : "below"}</span></div>
          </div>
        )}
      </div>

      {/* paid: signal deep-dive */}
      <div className={`card ${data && !data.paid ? "locked" : ""}`}>
        <h3>Your signal on {symbol}</h3>
        {data?.paid && data.signal ? (
          <div className="statgrid">
            <div className="stat"><span className="sl">Fires in last 50 bars</span><span className="sv">{data.signal.firesInLast50}</span></div>
            <div className="stat"><span className="sl">Last fired</span><span className="sv">{data.signal.lastFiredAt ? new Date(data.signal.lastFiredAt).toUTCString().slice(5, 22) : "—"}</span></div>
            <div className="stat"><span className="sl">1D timeframe</span><span className={`sv ${data.signal.htfFired ? "up" : "down"}`}>{data.signal.htfFired == null ? "—" : data.signal.htfFired ? "also firing" : "not firing"}</span></div>
          </div>
        ) : data && !data.paid ? (
          <div className="lockbody">
            <p>Signal history, last-fired bar, and higher-timeframe confirmation are part of the pass.</p>
            <a className="cta" href="/buy">Unlock with a pass →</a>
          </div>
        ) : <p className="sub">Loading…</p>}
      </div>

      <a className="ghost" style={{ textAlign: "center" }} href="/">← Back to the scanner</a>
    </main>
  );
}
