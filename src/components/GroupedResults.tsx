import Link from "next/link";

export interface Hit {
  symbol: string; bias: "long" | "short"; confidence: "high" | "medium" | "low";
  score: number; change24h: number; htf: boolean; btc: boolean; corr: number;
}

const CONF_ORDER: Hit["confidence"][] = ["high", "medium", "low"];
const CONF_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

function Row({ h, tf }: { h: Hit; tf: string }) {
  return (
    <Link className="rw" href={`/coin/${h.symbol}?tf=${tf}&bias=${h.bias}`}>
      <span className="sym">{h.symbol}</span>
      <span className={`pct ${h.change24h >= 0 ? "up" : "down"}`}>{h.change24h >= 0 ? "+" : "−"}{Math.abs(h.change24h).toFixed(2)}%</span>
      <span className="score">{h.score}</span>
      <span className="chev">›</span>
    </Link>
  );
}

function Group({ title, cls, hits, tf }: { title: string; cls: string; hits: Hit[]; tf: string }) {
  if (!hits.length) return null;
  return (
    <div className={`card group ${cls}`}>
      <h3>{title}<span className="count">{hits.length}</span></h3>
      {CONF_ORDER.map((c) => {
        const sub = hits.filter((h) => h.confidence === c);
        if (!sub.length) return null;
        return (
          <div key={c} className="confblock">
            <p className={`conflabel ${c}`}>{CONF_LABEL[c]}</p>
            <div className="res">{sub.map((h) => <Row key={h.symbol} h={h} tf={tf} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupedResults({ hits, scanned, tf }: { hits: Hit[]; scanned: number; tf: string }) {
  const longs = hits.filter((h) => h.bias === "long");
  const shorts = hits.filter((h) => h.bias === "short");
  return (
    <div className="flow">
      <div className="resmeta">{hits.length} of {scanned} coins passed on the last {tf} candle</div>
      <Group title="Long-biased" cls="glong" hits={longs} tf={tf} />
      <Group title="Short-biased" cls="gshort" hits={shorts} tf={tf} />
    </div>
  );
}
