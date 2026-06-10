import { PineTS } from "pinets";
import COVERAGE_INDEX from "./pine-coverage.json";

const COV: Record<string, boolean> = COVERAGE_INDEX as any;
const NAMESPACES = Array.from(new Set(Object.keys(COV).filter(k => k.includes(".")).map(k => k.split(".")[0])));

export interface Candle { open: number; high: number; low: number; close: number; volume: number; openTime: number; closeTime?: number }

/* ---------- signal detection (paren-aware, no full parse needed) ---------- */
function stripComments(src: string): string {
  return src.split("\n").map((l) => {
    let o = "", s: string | null = null;
    for (let i = 0; i < l.length; i++) { const c = l[i];
      if (s) { o += c; if (c === s && l[i - 1] !== "\\") s = null; continue; }
      if (c === '"' || c === "'") { s = c; o += c; continue; }
      if (c === "/" && l[i + 1] === "/") break; o += c; }
    return o;
  }).join("\n");
}
function firstArg(code: string, openIdx: number): string | null {
  let d = 0;
  for (let i = openIdx; i < code.length; i++) { const c = code[i];
    if (c === "(" || c === "[") d++;
    else if (c === ")" || c === "]") { d--; if (d === 0) return code.slice(openIdx + 1, i).split(",")[0].trim(); }
    else if (c === "," && d === 1) return code.slice(openIdx + 1, i).trim();
  }
  return null;
}
function findCallArg(code: string, fn: string): string | null {
  const re = new RegExp(fn.replace(".", "\\.") + "\\s*\\(", "g"); let m: RegExpExecArray | null;
  while ((m = re.exec(code))) { const a = firstArg(code, m.index + m[0].length - 1); if (a) return a; }
  return null;
}
const PRIORITY = ["longcondition", "long", "buy", "bull", "bullish", "enterlong", "golong", "signal", "entry"];

export function detectSignal(srcRaw: string): { expr: string | null; via: string | null } {
  const src = stripComments(srcRaw);
  for (const fn of ["alertcondition", "plotshape", "plotchar"]) {
    const a = findCallArg(src, fn);
    if (a) return { expr: a, via: fn };
  }
  const cands: { name: string; rhs: string }[] = [];
  for (const ln of src.split("\n")) {
    const m = ln.match(/^(?:\s*)(?:var\s+)?(?:bool\s+)?([A-Za-z_]\w*)\s*(?::=|=)\s*(.+)$/);
    if (!m) continue;
    const [, name, rhs] = m;
    if (/crossover|crossunder|[<>]=?|==|!=|\band\b|\bor\b/.test(rhs) &&
        !/^(plot|strategy|indicator|alertcondition|hline|bgcolor|fill)\b/.test(rhs.trim()))
      cands.push({ name, rhs });
  }
  for (const p of PRIORITY) { const f = cands.find((c) => c.name.toLowerCase() === p); if (f) return { expr: f.name, via: "variable:" + f.name }; }
  if (cands.length) { const last = cands[cands.length - 1]; return { expr: last.name, via: "variable:" + last.name }; }
  return { expr: null, via: null };
}

export function detectKind(srcRaw: string): "indicator" | "strategy" | "unknown" {
  const s = stripComments(srcRaw);
  if (/\bstrategy\s*\(/.test(s)) return "strategy";
  if (/\bindicator\s*\(/.test(s)) return "indicator";
  return "unknown";
}

/* ---------- run the user's signal over candles, return per-bar fired series ---------- */
export async function runSignal(code: string, signalExpr: string, candles: Candle[], symbol: string, tf: string): Promise<number[]> {
  const probe = `${code}\nplot((${signalExpr}) ? 1 : 0, "ic_signal")\n`;
  const ctx = await new PineTS(candles as any, symbol, tf, candles.length).run(probe);
  const data = (ctx as any).plots?.["ic_signal"]?.data ?? [];
  return data.map((d: any) => Number(d?.value) || 0);
}

/* ---------- honest coverage: actually run on synthetic candles ---------- */
function synthetic(n = 160): Candle[] {
  const out: Candle[] = []; let p = 100;
  for (let i = 0; i < n; i++) { p += Math.sin(i / 6) * 1.6 + 0.5; const o = p, c = p + Math.sin(i / 3), h = Math.max(o, c) + 1, l = Math.min(o, c) - 1;
    out.push({ open: o, high: h, low: l, close: c, volume: 1000 + i, openTime: 1700000000000 + i * 3600000 }); }
  return out;
}

export interface CoverageResult {
  kind: "indicator" | "strategy" | "unknown";
  signal: string | null; via: string | null;
  understoodPct: number; faithfulnessPct: number;
  supported: boolean; unsupported: string[];
}

export interface FnUse { name: string; supported: boolean }

/** Static scan: find every namespaced call (ta.ema, request.security, ...) and
 *  classify it against PineTS's published coverage index. */
export function analyzeCalls(srcRaw: string): { recognized: FnUse[]; unknown: string[] } {
  const src = stripComments(srcRaw);
  const recognized: FnUse[] = []; const seen = new Set<string>(); const unknown: string[] = [];
  const re = /\b([a-z][a-z0-9]*)\.([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const ns = m[1], fn = `${m[1]}.${m[2]}`;
    if (!NAMESPACES.includes(ns)) continue;
    if (seen.has(fn)) continue; seen.add(fn);
    if (fn in COV) recognized.push({ name: fn, supported: COV[fn] });
    else unknown.push(fn); // namespaced but not in the index (rare/new)
  }
  return { recognized, unknown };
}

function mapRunError(msg: string): string {
  if (/tickerid|syminfo/i.test(msg)) return "request.security / multi-timeframe needs symbol context (limited in this data mode)";
  return msg.slice(0, 120);
}

export async function coverage(code: string): Promise<CoverageResult> {
  const kind = detectKind(code);
  const sig = detectSignal(code);

  // ---- static coverage against PineTS's published index ----
  const { recognized, unknown } = analyzeCalls(code);
  const supportedCount = recognized.filter((r) => r.supported).length;
  const unsupportedFns = recognized.filter((r) => !r.supported).map((r) => r.name);
  const total = recognized.length;

  // ---- live run on synthetic candles to catch runtime gaps ----
  let ran = false; let runErr = "";
  try { await new PineTS(synthetic() as any, "TUSDT", "1h", 160).run(code); ran = true; }
  catch (e: any) { runErr = mapRunError(String(e?.message || e)); }

  const unsupported = Array.from(new Set([
    ...unsupportedFns,
    ...unknown.map((u) => `${u} (not in coverage index)`),
    ...(runErr ? [runErr] : []),
  ]));

  // understood% = share of recognized calls that are supported, blended with run success
  let understoodPct: number;
  if (total > 0) understoodPct = Math.round((supportedCount / total) * 100);
  else understoodPct = ran ? 100 : 60;
  if (ran && total > 0) understoodPct = Math.min(100, understoodPct + 3);
  if (!ran && runErr) understoodPct = Math.min(understoodPct, 70);

  const supported = ran && !!sig.expr && unsupportedFns.length === 0;
  const faithfulnessPct = supported ? 100 : sig.expr ? (ran ? 75 : 35) : 0;

  return { kind, signal: sig.expr, via: sig.via, understoodPct, faithfulnessPct, supported, unsupported };
}
