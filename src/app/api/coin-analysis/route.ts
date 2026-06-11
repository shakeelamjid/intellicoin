import { NextResponse } from "next/server";
import { activePass } from "@/lib/pass";
import { requireAdmin } from "@/lib/admin";
import { fetchKlines } from "@/data/exchanges";
import { runSignal } from "@/engine/pinets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function emaArr(v: number[], len: number){const k=2/(len+1);const o:number[]=[];let p=v[0];for(let i=0;i<v.length;i++){p=i===0?v[0]:v[i]*k+p*(1-k);o.push(p);}return o;}
function rsi(v: number[], len=14){let g=0,l=0;for(let i=1;i<=len;i++){const d=v[i]-v[i-1];if(d>0)g+=d;else l-=d;}g/=len;l/=len;const out:number[]=[];out[len]=100-100/(1+(l===0?100:g/l));for(let i=len+1;i<v.length;i++){const d=v[i]-v[i-1];g=(g*(len-1)+Math.max(d,0))/len;l=(l*(len-1)+Math.max(-d,0))/len;out[i]=100-100/(1+(l===0?100:g/l));}return out;}

export async function POST(req: Request) {
  const { code, expr, symbol, tf, exchange } = await req.json().catch(() => ({}));
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  const pass = (await activePass()) || ((await requireAdmin()) ? { id: "admin" } : null);

  // free tier: price context only
  const candles = await fetchKlines(exchange || "Binance", symbol, tf || "4h", 220);
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const e20 = emaArr(closes, 20), e50 = emaArr(closes, 50);
  const r = rsi(closes, 14);
  const baseStats = {
    price: last.close,
    rsi14: Math.round((r[r.length - 1] || 0) * 10) / 10,
    aboveEma20: last.close > e20[e20.length - 1],
    aboveEma50: last.close > e50[e50.length - 1],
  };
  if (!pass) return NextResponse.json({ paid: false, stats: baseStats });

  // paid: run the user's signal on this coin for history + last-fired bar
  let firedBars: number[] = [];
  let lastFiredAt: number | null = null;
  if (code && expr) {
    try {
      const fired = await runSignal(code, expr, candles, symbol, tf || "4h");
      fired.forEach((f, i) => { if (f > 0) firedBars.push(i); });
      if (firedBars.length) lastFiredAt = candles[firedBars[firedBars.length - 1]].openTime;
    } catch { /* engine couldn't run on this coin */ }
  }

  // HTF check
  let htfFired: boolean | null = null;
  if (code && expr) {
    try { const hi = await fetchKlines(exchange || "Binance", symbol, "1D", 220);
      const hf = await runSignal(code, expr, hi, symbol, "1D");
      htfFired = hf.length > 0 && hf[hf.length - 1] > 0;
    } catch { htfFired = null; }
  }

  return NextResponse.json({
    paid: true,
    stats: baseStats,
    signal: {
      firesInLast50: firedBars.filter((i) => i >= candles.length - 50).length,
      lastFiredAt,
      htfFired,
    },
  });
}
