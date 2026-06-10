"use client";
import { useEffect, useRef, useState } from "react";
import ScriptInput, { type Cov } from "./ScriptInput";
import ScanConfig, { type ScanCfg } from "./ScanConfig";
import RunPanel from "./RunPanel";
import ResultsTable from "./ResultsTable";
import type { ScanHit } from "@/engine/types";

const SAMPLE = `//@version=5
indicator("EMA cross + RSI filter")
fast = ta.ema(close, 21)
slow = ta.ema(close, 55)
buy  = ta.crossover(fast, slow) and ta.rsi(close, 14) > 50
plotshape(buy, "Buy", style=shape.triangleup)
alertcondition(buy, "Long signal")`;

export default function ScannerApp() {
  const [code, setCode] = useState(SAMPLE);
  const [cov, setCov] = useState<Cov | null>(null);
  const [covLoading, setCovLoading] = useState(false);
  const [cfg, setCfg] = useState<ScanCfg>({ exchange: "Binance", tf: "4h", filters: { btc: true }, universe: 50 });
  const [universeMax, setUniverseMax] = useState(200);

  const [hits, setHits] = useState<ScanHit[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState("");
  const [note, setNote] = useState("");
  const [scanned, setScanned] = useState<number | null>(null);

  // identity (remaining) + pricing (universe default/max)
  useEffect(() => {
    fetch("/api/identity").then((r) => r.json()).then((d) => { setUnlimited(!!d.pass); setRemaining(d.pass ? null : d.remaining); }).catch(() => {});
    fetch("/api/pricing").then((r) => r.json()).then((d) => {
      if (d.scanUniverseMax) setUniverseMax(d.scanUniverseMax);
      if (d.scanUniverseDefault) setCfg((c) => ({ ...c, universe: d.scanUniverseDefault }));
    }).catch(() => {});
  }, []);

  // debounced server coverage whenever code changes
  const timer = useRef<any>(null);
  useEffect(() => {
    setCovLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        setCov(await r.json());
      } catch { setCov(null); } finally { setCovLoading(false); }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [code]);

  async function run() {
    setBusy(true); setGate(""); setNote("");
    try {
      const r = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, exchange: cfg.exchange, timeframe: cfg.tf, filters: cfg.filters, universe: cfg.universe }),
      });
      const d = await r.json();
      if (r.status === 402) { setGate(d.message || "Free limit reached."); return; }
      if (d.ran === false) { setNote(d.message || d.error || "Couldn't run this script yet."); setHits([]); return; }
      if (d.allowed && d.ran) {
        setHits(d.hits || []); setScanned(d.scanned ?? null);
        if (d.unlimited) setUnlimited(true);
        else if (typeof d.remaining === "number") setRemaining(d.remaining);
        if ((d.hits || []).length === 0) setNote(`No coins matched on the last ${cfg.tf} candle (scanned ${d.scanned}).`);
      }
    } catch (e: any) { setNote("Scan failed: " + (e?.message || e)); } finally { setBusy(false); }
  }

  return (
    <div className="work">
      <div className="col">
        <ScriptInput value={code} onChange={setCode} cov={cov} loading={covLoading} />
        <ScanConfig cfg={cfg} setCfg={setCfg} universeMax={universeMax} />
      </div>
      <div className="col side">
        <RunPanel remaining={remaining} unlimited={unlimited} busy={busy} gate={gate} onRun={run} />
        <ResultsTable hits={hits} note={note} scanned={scanned} />
      </div>
    </div>
  );
}
