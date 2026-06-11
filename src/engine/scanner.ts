import { runSignal, type Candle } from "./pinets";
import { fetchUniverse, fetchKlines } from "@/data/exchanges";

export interface GroupedHit {
  symbol: string; bias: "long" | "short";
  confidence: "high" | "medium" | "low"; score: number;
  change24h: number; htf: boolean; btc: boolean; corr: number; volRank: number;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]); } catch { out[idx] = undefined as any; } }
  });
  await Promise.all(workers);
  return out.filter((x) => x !== undefined);
}

function ema(values: number[], len: number): number[] {
  const k = 2 / (len + 1); const out: number[] = []; let prev = values[0];
  for (let i = 0; i < values.length; i++) { prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k); out.push(prev); } return out;
}
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length); if (n < 5) return 0;
  const xa = a.slice(-n), xb = b.slice(-n);
  const ma = xa.reduce((s, v) => s + v, 0) / n, mb = xb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = xa[i] - ma, y = xb[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
const returns = (c: Candle[]) => c.slice(1).map((x, i) => (x.close - c[i].close) / c[i].close);

export interface ScanParams {
  code: string;
  longExpr: string | null; shortExpr: string | null;
  exchange: string; tf: string; universeSize: number;
  filters: { btc?: boolean; htf?: boolean; corr?: boolean; vol?: boolean };
  minVolume?: number;
}

/** Confidence blend: base for firing, + HTF agreement, + BTC regime alignment,
 *  + correlation, + volume standing. Honest and explainable. */
function scoreOf(x: { htfChecked: boolean; htf: boolean; btcChecked: boolean; btcAligned: boolean; corrChecked: boolean; corrOk: boolean; volRank: number }): number {
  let s = 40; // fired on the scan timeframe
  if (x.htfChecked && x.htf) s += 25;
  if (x.btcChecked && x.btcAligned) s += 15;
  if (x.corrChecked && x.corrOk) s += 10;
  s += Math.round(10 * x.volRank); // 0..10 by liquidity standing
  return Math.min(100, s);
}
const band = (s: number): "high" | "medium" | "low" => (s >= 75 ? "high" : s >= 55 ? "medium" : "low");

export async function runScan(p: ScanParams): Promise<{ hits: GroupedHit[]; scanned: number }> {
  const universe = await fetchUniverse(p.exchange, p.universeSize);
  const maxVol = Math.max(...universe.map((u) => u.quoteVolume), 1);

  let btcRiskOn = true; let btcReturns: number[] = [];
  if (p.filters.btc || p.filters.corr) {
    try {
      const btc = await fetchKlines(p.exchange, "BTCUSDT", p.tf, 220);
      const closes = btc.map((c) => c.close); const e200 = ema(closes, 200);
      btcRiskOn = closes[closes.length - 1] > e200[e200.length - 1];
      btcReturns = returns(btc);
    } catch { /* ignore */ }
  }

  const hits = await pool(universe, 6, async (u): Promise<GroupedHit | undefined> => {
    const candles = await fetchKlines(p.exchange, u.symbol, p.tf, 220);
    if (candles.length < 30) return undefined;

    const fire = async (expr: string | null, tfArg = p.tf, cds = candles) => {
      if (!expr) return false;
      const f = await runSignal(p.code, expr, cds, u.symbol, tfArg);
      return f.length > 0 && f[f.length - 1] > 0;
    };

    const longFired = await fire(p.longExpr);
    const shortFired = !longFired && (await fire(p.shortExpr)); // prefer long if both
    if (!longFired && !shortFired) return undefined;
    const bias: "long" | "short" = longFired ? "long" : "short";
    const expr = longFired ? p.longExpr : p.shortExpr;

    // BTC regime: aligned = risk-on for longs, risk-off for shorts
    const btcAligned = bias === "long" ? btcRiskOn : !btcRiskOn;
    if (p.filters.btc && !btcAligned) return undefined;
    if (p.filters.vol && p.minVolume && u.quoteVolume < p.minVolume) return undefined;

    let corr = 0; let corrOk = true;
    if (p.filters.corr && btcReturns.length) {
      corr = pearson(returns(candles), btcReturns);
      corrOk = corr >= 0.6;
      if (!corrOk) return undefined;
    }

    let htf = false;
    if (p.filters.htf) {
      try { const hi = await fetchKlines(p.exchange, u.symbol, "1D", 220); htf = await fire(expr, "1D", hi); }
      catch { htf = false; }
      if (!htf) return undefined;
    }

    const volRank = u.quoteVolume / maxVol;
    const score = scoreOf({ htfChecked: !!p.filters.htf, htf, btcChecked: !!p.filters.btc, btcAligned, corrChecked: !!p.filters.corr, corrOk, volRank });

    return { symbol: u.symbol, bias, confidence: band(score), score, change24h: u.change24h, htf, btc: btcAligned, corr: corr || 0, volRank: Math.round(volRank * 100) / 100 };
  });

  const list = (hits.filter(Boolean) as GroupedHit[]).sort((a, b) => b.score - a.score);
  return { hits: list, scanned: universe.length };
}
