"use client";

type Props = { remaining: number | null; unlimited: boolean; busy: boolean; gate: string; onRun: () => void };

export default function RunPanel({ remaining, unlimited, busy, gate, onRun }: Props) {
  return (
    <div className="card runbox">
      <span className="meta">
        {unlimited ? "Pass active · unlimited scans"
          : remaining === null ? "Free plan"
          : `Free plan · ${remaining} ${remaining === 1 ? "scan" : "scans"} left today`}
      </span>
      <button className="cta btn-block" onClick={onRun} disabled={busy}>{busy ? "Scanning…" : "Run scan →"}</button>
      {gate && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <p style={{ color: "var(--down)", fontSize: ".85rem", margin: "0 0 10px" }}>{gate}</p>
          <a className="cta btn-block" href="/buy" style={{ display: "inline-block", textAlign: "center" }}>Buy a pass →</a>
        </div>
      )}
    </div>
  );
}
