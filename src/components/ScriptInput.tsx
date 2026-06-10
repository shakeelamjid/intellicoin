"use client";
import { useEffect, useState } from "react";

export interface Cov {
  kind: string; understoodPct: number; faithfulnessPct: number;
  supported: boolean; signal: string | null; unsupported: string[]; read: string;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <div className="mh"><span className="ml">{label}</span><span className="mv">{value}%</span></div>
      <div className="bar"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export default function ScriptInput({
  value, onChange, cov, loading,
}: { value: string; onChange: (v: string) => void; cov: Cov | null; loading: boolean }) {
  return (
    <div className="card">
      <h3><span className="num">1</span> Paste your indicator or strategy</h3>
      <p className="sub">Pine v5 / v6. Read fresh on every run — never stored. Runs on a real engine (PineTS).</p>
      <textarea className="ta" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Pine source" />

      <div className="paste-row">
        <span className="pill kind">{cov?.kind ?? "—"}</span>
        <span className="pill">{loading ? "reading…" : cov?.signal ? `signal → ${cov.signal}` : "no signal found"}</span>
      </div>

      <div className="meters">
        <Meter label="Understood" value={cov?.understoodPct ?? 0} />
        <Meter label="Scanner built" value={cov?.faithfulnessPct ?? 0} />
      </div>

      {cov && cov.supported ? (
        <div className="read"><span className="tag">What this says</span><p>{cov.read}</p></div>
      ) : cov ? (
        <div className="read" style={{ borderLeftColor: "var(--down)" }}>
          <span className="tag" style={{ color: "var(--down)" }}>What we couldn&rsquo;t read</span>
          <p>{cov.unsupported?.length ? cov.unsupported.join("; ") : cov.read}</p>
        </div>
      ) : null}
    </div>
  );
}
