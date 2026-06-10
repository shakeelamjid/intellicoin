import { runSignal, type Candle } from "./pinets";
import { fetchUniverse, fetchKlines } from "@/data/exchanges";
import type { ScanHit } from "./types";

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
  code: string; signalExpr: string; exchange: string; tf: string;
  universeSize: number; filters: { btc?: boolean; htf?: boolean; corr?: boolean; vol?: boolean };
  minVolume?: number;
}

export async function runScan(p: ScanParams): Promise<{ hits: ScanHit[]; scanned: number }> {
  const universe = await fetchUniverse(p.exchange, p.universeSize);

  // BTC context (for regime + correlation), fetched once
  let btcRiskOn = true; let btcReturns: number[] = [];
  if (p.filters.btc || p.filters.corr) {
    try {
      const btc = await fetchKlines(p.exchange, "BTCUSDT", p.tf, 220);
      const closes = btc.map((c) => c.close); const e200 = ema(closes, 200);
      btcRiskOn = closes[closes.length - 1] > e200[e200.length - 1];
      btcReturns = returns(btc);
    } catch { /* ignore */ }
  }

  const hits = await pool(universe, 6, async (u): Promise<ScanHit | undefined> => {
    const candles = await fetchKlines(p.exchange, u.symbol, p.tf, 220);
    if (candles.length < 30) return undefined;
    const fired = await runSignal(p.code, p.signalExpr, candles, u.symbol, p.tf);
    if (!fired.length || fired[fired.length - 1] <= 0) return undefined;

    // filters
    if (p.filters.btc && !btcRiskOn) return undefined;
    if (p.filters.vol && p.minVolume && u.quoteVolume < p.minVolume) return undefined;

    let corr = 0;
    if (p.filters.corr && btcReturns.length) corr = pearson(returns(candles), btcReturns);
    if (p.filters.corr && corr < 0.6) return undefined;

    let htf = true;
    if (p.filters.htf) {
      try {
        const hi = await fetchKlines(p.exchange, u.symbol, "1D", 220);
        const hf = await runSignal(p.code, p.signalExpr, hi, u.symbol, "1D");
        htf = hf.length > 0 && hf[hf.length - 1] > 0;
        if (!htf) return undefined;
      } catch { htf = false; }
    }

    return { symbol: u.symbol, change24h: u.change24h, htf, btc: btcRiskOn, corr: corr || 0.7 };
  });

  return { hits: hits.filter(Boolean) as ScanHit[], scanned: universe.length };
}
