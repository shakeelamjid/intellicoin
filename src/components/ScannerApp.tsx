"use client";
import { useEffect, useRef, useState } from "react";
import ScanConfig, { type ScanCfg } from "./ScanConfig";
import GroupedResults, { type Hit } from "./GroupedResults";

const SAMPLE = `//@version=5
indicator("EMA cross + RSI filter")
fast = ta.ema(close, 21)
slow = ta.ema(close, 55)
long  = ta.crossover(fast, slow) and ta.rsi(close, 14) > 50
short = ta.crossunder(fast, slow) and ta.rsi(close, 14) < 50
plotshape(long, "Long", style=shape.triangleup)
alertcondition(long, "Long signal")`;

type StageLine = { id: string; label: string; detail?: string; ok: boolean };

export default function ScannerApp() {
  const [code, setCode] = useState(SAMPLE);
  const [phase, setPhase] = useState<"paste" | "analyzing" | "understood" | "scanning" | "results">("paste");
  const [stages, setStages] = useState<StageLine[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [cfg, setCfg] = useState<ScanCfg>({ exchange: "Binance", tf: "4h", filters: { btc: true }, universe: 50 });
  const [universeMax, setUniverseMax] = useState(200);
  const [hits, setHits] = useState<Hit[]>([]);
  const [scanned, setScanned] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [gate, setGate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/identity").then((r) => r.json()).then((d) => { setUnlimited(!!d.pass); setRemaining(d.pass ? null : d.remaining); }).catch(() => {});
    fetch("/api/pricing").then((r) => r.json()).then((d) => {
      if (d.scanUniverseMax) setUniverseMax(d.scanUniverseMax);
      if (d.scanUniverseDefault) setCfg((c) => ({ ...c, universe: d.scanUniverseDefault }));
    }).catch(() => {});
  }, []);

  const push = (l: StageLine) => setStages((s) => [...s.filter((x) => x.id !== l.id), l]);

  async function analyze() {
    setPhase("analyzing"); setStages([]); setAnalysis(null); setNote(""); setGate("");
    try {
      const res = await fetch("/api/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.stage === "kind") push({ id: "kind", ok: true, label: `Detected Pine v${m.version ?? "?"} ${m.kind}` });
          if (m.stage === "functions") push({ id: "fn", ok: m.unsupported.length === 0, label: `Read ${m.total} Pine functions`, detail: m.unsupported.length ? `unsupported: ${m.unsupported.join(", ")}` : "all supported by the engine" });
          if (m.stage === "signals") push({ id: "sig", ok: !!(m.long || m.short), label: m.long || m.short ? `Found trigger${m.short ? "s" : ""}: ${[m.long?.expr, m.short?.expr].filter(Boolean).join(" / ")}` : "No trigger found", detail: m.short ? "long + short detected" : m.long ? "long-biased" : undefined });
          if (m.stage === "engine") push({ id: "eng", ok: m.understoodPct >= 95, label: `Engine test run — understood ${m.understoodPct}%`, detail: m.unsupported?.length ? m.unsupported.join("; ") : "executed cleanly on test candles" });
          if (m.stage === "read") push({ id: "read", ok: true, label: "Built plain-English read", detail: m.read });
          if (m.stage === "done") { setAnalysis(m); setPhase("understood"); }
          if (m.stage === "error") { push({ id: "err", ok: false, label: m.message }); setPhase("paste"); }
        }
      }
    } catch (e: any) { push({ id: "err", ok: false, label: "Analysis failed: " + (e?.message || e) }); setPhase("paste"); }
  }

  async function run() {
    setPhase("scanning"); setGate(""); setNote("");
    try {
      const r = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, exchange: cfg.exchange, timeframe: cfg.tf, filters: cfg.filters, universe: cfg.universe }),
      });
      const d = await r.json();
      if (r.status === 402) { setGate(d.message || "Free limit reached."); setPhase("understood"); return; }
      if (!d.ran) { setNote(d.message || d.error || "Couldn't run this scan."); setPhase("understood"); return; }
      setHits(d.hits || []); setScanned(d.scanned || 0);
      if (d.unlimited) setUnlimited(true); else if (typeof d.remaining === "number") setRemaining(d.remaining);
      // stash context for coin pages (client-side only — code is never stored server-side)
      try { sessionStorage.setItem("ic_ctx", JSON.stringify({ code, long: analysis?.signals?.long?.expr ?? null, short: analysis?.signals?.short?.expr ?? null, tf: cfg.tf, exchange: cfg.exchange })); } catch {}
      setPhase("results");
      if ((d.hits || []).length === 0) setNote(`No coins matched on the last ${cfg.tf} candle (scanned ${d.scanned}).`);
    } catch (e: any) { setNote("Scan failed: " + (e?.message || e)); setPhase("understood"); }
  }

  return (
    <div className="flow">
      {/* BIG PASTE BOX */}
      <div className="card paste-card">
        <textarea className="ta ta-big" spellCheck={false} value={code} onChange={(e) => { setCode(e.target.value); if (phase !== "paste") setPhase("paste"); }} placeholder="// Paste your TradingView indicator or strategy here (Pine v5 / v6)" aria-label="Pine source" />
        <div className="paste-foot">
          <span className="hint">Read fresh on every run — never stored.</span>
          <button className="cta btn-lg" onClick={analyze} disabled={phase === "analyzing"}>
            {phase === "analyzing" ? "Analyzing…" : "Analyze code →"}
          </button>
        </div>
      </div>

      {/* STREAMING ANALYSIS */}
      {stages.length > 0 && (
        <div className="card">
          <h3>Reading your script</h3>
          <div className="stages">
            {stages.map((s) => (
              <div key={s.id} className={`stage ${s.ok ? "ok" : "bad"}`}>
                <span className="dot">{s.ok ? "✓" : "✗"}</span>
                <div><div className="sl">{s.label}</div>{s.detail && <div className="sd">{s.detail}</div>}</div>
              </div>
            ))}
            {phase === "analyzing" && <div className="stage wait"><span className="dot spin">◌</span><div className="sl">working…</div></div>}
          </div>
        </div>
      )}

      {/* UNDERSTANDING */}
      {analysis && (phase === "understood" || phase === "scanning" || phase === "results") && (
        <div className="card read-card">
          <h3>What your code says</h3>
          <p className="bigread">{stages.find((s) => s.id === "read")?.detail}</p>
          <div className="meters">
            <div className="meter"><div className="mh"><span className="ml">Understood</span><span className="mv">{analysis.coverage.understoodPct}%</span></div><div className="bar"><i style={{ width: `${analysis.coverage.understoodPct}%` }} /></div></div>
            <div className="meter"><div className="mh"><span className="ml">Scanner built</span><span className="mv">{analysis.coverage.faithfulnessPct}%</span></div><div className="bar"><i style={{ width: `${analysis.coverage.faithfulnessPct}%` }} /></div></div>
          </div>
        </div>
      )}

      {/* CONSTRAINTS + RUN */}
      {analysis && (phase === "understood" || phase === "scanning" || phase === "results") && (
        <>
          <ScanConfig cfg={cfg} setCfg={setCfg} universeMax={universeMax} />
          <div className="card runbox">
            <span className="meta">{unlimited ? "Pass active · unlimited scans" : remaining === null ? "Free plan" : `Free plan · ${remaining} ${remaining === 1 ? "scan" : "scans"} left today`}</span>
            <button className="cta btn-block btn-lg" onClick={run} disabled={phase === "scanning"}>{phase === "scanning" ? `Scanning ${cfg.universe} coins…` : "Run the scanner →"}</button>
            {gate && (<div className="gatebox"><p>{gate}</p><a className="cta btn-block" href="/buy">Buy a pass →</a></div>)}
            {note && <p className="notice">{note}</p>}
          </div>
        </>
      )}

      {/* GROUPED RESULTS */}
      {phase === "results" && <GroupedResults hits={hits} scanned={scanned} tf={cfg.tf} />}
    </div>
  );
}
