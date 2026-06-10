export interface Candle { open: number; high: number; low: number; close: number; volume: number; openTime: number }
export interface ScanHit { symbol: string; change24h: number; htf: boolean; btc: boolean; corr: number }
export interface Coverage {
  kind: "indicator" | "strategy" | "unknown";
  understoodPct: number;
  faithfulnessPct: number;
  supported: boolean;
  signal: string | null;
  unsupported: string[];
}
