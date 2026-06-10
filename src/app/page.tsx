import ScannerApp from "@/components/ScannerApp";
import HowItWorks from "@/components/HowItWorks";

export default function HomePage() {
  return (
    <main className="wrap">
      <p className="eyebrow">Indicator &amp; strategy scanner</p>
      <h1>Paste a TradingView indicator. Scan the whole market.</h1>
      <p className="lede">
        Drop in any Pine indicator or strategy. IntelliCoin reads it, tells you how much it
        understood, builds a scanner, and runs it across every coin — your exchange, your
        timeframe, your filters.
      </p>
      <ScannerApp />
      <HowItWorks />
    </main>
  );
}
