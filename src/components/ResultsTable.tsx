import Link from "next/link";
import type { ScanHit } from "@/engine/types";

function mark(ok: boolean, label: string) { return <span className={ok ? "y" : "n"}>{label}{ok ? "✓" : "✗"}</span>; }

export default function ResultsTable({ hits, note, scanned }: { hits: ScanHit[]; note?: string; scanned?: number | null }) {
  return (
    <div className="card">
      <h3>Passing coins
        <span style={{ marginLeft: "auto", fontFamily: "var(--f-mono)", fontSize: ".78rem", color: "var(--tx3)" }}>
          {hits.length ? `${hits.length}${scanned ? ` / ${scanned}` : ""}` : "—"}
        </span>
      </h3>
      <p className="sub">{hits.length ? "Fired on the last closed candle, filters satisfied." : (note || "Run a scan to see passing coins.")}</p>
      {hits.length > 0 && (
        <div className="res">
          <div className="hr"><span>Symbol</span><span className="pct">24h</span><span>Filters</span><span /></div>
          {hits.map((h) => (
            <Link key={h.symbol} className="rw" href={`/coin/${h.symbol}`}>
              <span className="sym">{h.symbol}</span>
              <span className={`pct ${h.change24h >= 0 ? "up" : "down"}`}>{h.change24h >= 0 ? "+" : "−"}{Math.abs(h.change24h).toFixed(2)}%</span>
              <span className="mk">{mark(h.htf, "HTF")}{mark(h.btc, "BTC")}{mark(h.corr >= 0.6, "ρ")}</span>
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
