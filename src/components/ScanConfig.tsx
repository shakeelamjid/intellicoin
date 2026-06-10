"use client";

import { EXCHANGES, TIMEFRAMES, FILTERS } from "@/config/scan";

export interface ScanCfg {
  exchange: string; tf: string; filters: Record<string, boolean>; universe: number;
}

export default function ScanConfig({
  cfg, setCfg, universeMax,
}: { cfg: ScanCfg; setCfg: (c: ScanCfg) => void; universeMax: number }) {
  const toggle = (id: string) => setCfg({ ...cfg, filters: { ...cfg.filters, [id]: !cfg.filters[id] } });
  const universeOptions = [25, 50, 100, 200, 500].filter((n) => n <= (universeMax || 200));
  if (!universeOptions.includes(cfg.universe)) universeOptions.unshift(cfg.universe);

  return (
    <div className="card">
      <h3><span className="num">2</span> Set up the scan — your rules</h3>
      <p className="sub">Nothing forced. BTC awareness is just one optional filter.</p>

      <p className="label">Exchange</p>
      <div className="seg" style={{ marginBottom: 18 }}>
        {EXCHANGES.map((e) => (
          <button key={e} className={cfg.exchange === e ? "on" : ""} onClick={() => setCfg({ ...cfg, exchange: e })}>{e}</button>
        ))}
      </div>

      <p className="label">Timeframe · 1m → 1D+</p>
      <div className="chips">
        {TIMEFRAMES.map((t) => (
          <button key={t} className={`chip ${cfg.tf === t ? "on" : ""}`} onClick={() => setCfg({ ...cfg, tf: t })}>{t}</button>
        ))}
      </div>

      <p className="label">How many coins to scan</p>
      <div className="seg" style={{ marginBottom: 18 }}>
        {universeOptions.map((n) => (
          <button key={n} className={cfg.universe === n ? "on" : ""} onClick={() => setCfg({ ...cfg, universe: n })}>{n}</button>
        ))}
      </div>

      <p className="label">Optional filters</p>
      <div className="chips" style={{ marginBottom: 0 }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${cfg.filters[f.id] ? "on" : ""}`} onClick={() => toggle(f.id)}>{f.label}</button>
        ))}
        <button className="chip add">+ Define your own</button>
      </div>
    </div>
  );
}
