// Scan configuration options for the single IntelliCoin scanner.
export const EXCHANGES = ["Binance", "Bybit", "OKX", "Coinbase", "Kraken"] as const;
export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1D", "3D", "1W"] as const;
export const FILTERS = [
  { id: "btc", label: "BTC regime", hint: "BTC > 200 EMA" },
  { id: "htf", label: "Higher timeframe", hint: "1D" },
  { id: "corr", label: "BTC correlation", hint: "≥ 0.6" },
  { id: "vol", label: "Min 24h volume", hint: "" },
] as const;
export type ExchangeName = (typeof EXCHANGES)[number];
export type TimeframeName = (typeof TIMEFRAMES)[number];
