import type { Candle } from "@/engine/pinets";

const BINANCE = "https://api.binance.com";

// our timeframe labels -> Binance intervals
const TF_MAP: Record<string, string> = {
  "1m":"1m","3m":"3m","5m":"5m","15m":"15m","30m":"30m","1h":"1h","2h":"2h","4h":"4h","6h":"6h","12h":"12h","1D":"1d","3D":"3d","1W":"1w",
};

export interface UniverseItem { symbol: string; change24h: number; quoteVolume: number }

export async function fetchUniverse(exchange: string, size: number): Promise<UniverseItem[]> {
  if (exchange !== "Binance") throw new Error(`Exchange "${exchange}" not supported yet — use Binance`);
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch market list");
  const all = (await r.json()) as any[];
  const skip = /(UP|DOWN|BULL|BEAR)USDT$/;
  return all
    .filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT") && !skip.test(t.symbol))
    .map((t) => ({ symbol: t.symbol, change24h: parseFloat(t.priceChangePercent), quoteVolume: parseFloat(t.quoteVolume) }))
    .filter((t) => Number.isFinite(t.quoteVolume))
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, Math.max(1, size));
}

export async function fetchKlines(exchange: string, symbol: string, tf: string, limit = 200): Promise<Candle[]> {
  if (exchange !== "Binance") throw new Error(`Exchange "${exchange}" not supported yet — use Binance`);
  const interval = TF_MAP[tf] ?? "4h";
  const url = `${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`klines ${symbol} ${r.status}`);
  const rows = (await r.json()) as any[];
  // Binance kline: [openTime, open, high, low, close, volume, closeTime, ...]
  return rows.map((k) => ({
    openTime: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5], closeTime: k[6],
  }));
}

export const exchangeName = (s: string) => s;
