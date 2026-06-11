import ScannerApp from "@/components/ScannerApp";
import HowItWorks from "@/components/HowItWorks";

export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero-big">
        <p className="eyebrow">Indicator &amp; strategy scanner</p>
        <h1>Paste a TradingView indicator.<br />Scan the whole market.</h1>
        <p className="lede">IntelliCoin reads your Pine script, shows you exactly what it understood, then hunts every coin for the setups it describes — grouped long and short, ranked by confidence.</p>
      </section>
      <ScannerApp />
      <HowItWorks />
    </main>
  );
}
