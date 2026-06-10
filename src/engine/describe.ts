import { detectSignal, detectKind } from "./pinets";

export function describe(code: string): string {
  const kind = detectKind(code);
  const { expr, via } = detectSignal(code);
  if (!expr) return "We couldn't find a single buy/long trigger. Add an alertcondition, a plotshape on your signal, or name a boolean like `buy`/`long`.";
  const bits: string[] = [];
  if (/crossover/.test(code)) bits.push("a moving-average crossover");
  if (/crossunder/.test(code)) bits.push("a moving-average crossunder");
  const rsi = code.match(/ta\.rsi\([^)]*\)\s*[<>]=?\s*(\d+)/);
  if (rsi) bits.push(`RSI ${code.includes(">") ? "above" : "below"} ${rsi[1]}`);
  const where = bits.length ? bits.join(" and ") : `your "${expr}" condition`;
  const src = via?.startsWith("variable") ? `the \`${expr}\` condition` : `${via}()`;
  return `This ${kind === "strategy" ? "strategy" : "indicator"} fires on ${where}. We scan every coin for the bar where ${src} becomes true.`;
}
