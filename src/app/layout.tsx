import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "IntelliCoin — paste a TradingView indicator, scan the market",
  description:
    "Drop in any Pine indicator or strategy. IntelliCoin reads it, builds a scanner, and runs it across every coin — your exchange, your timeframe, your filters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TopBar />
        {children}
        <footer className="foot">
          <span>INTELLI·COIN</span>
          <span>
            <a href="#how">How it works</a> · <a href="/buy">Pricing</a> ·{" "}
            <a href={process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/shakeelamjid/intellicoin"} target="_blank" rel="noreferrer">Source</a>
          </span>
        </footer>
      </body>
    </html>
  );
}
