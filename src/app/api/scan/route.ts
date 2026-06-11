import { NextResponse } from "next/server";
import { getIdentity, codeHash } from "@/lib/identity";
import { getSettings } from "@/db/init";
import { db } from "@/db/sql";
import { activePass } from "@/lib/pass";
import { FP_COOKIE } from "@/lib/session";
import { detectSignals } from "@/engine/pinets";
import { runScan } from "@/engine/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function withFp(res: import("next/server").NextResponse, fp: string) {
  if (fp) res.cookies.set(FP_COOKIE, fp, { httpOnly: true, sameSite: "lax", maxAge: 31536000, path: "/" });
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code: string = body.code || "";
  const exchange: string = body.exchange || "Binance";
  const tf: string = body.timeframe || "4h";
  const filters = body.filters || {};
  const pass = await activePass();
  const { id, fp } = await getIdentity();
  const s = await getSettings();

  if (!pass) {
    const ch = codeHash(code); const sql = db();
    const [u] = await sql`select scans, code_hashes from free_usage where identity = ${id} and day = current_date`;
    const scans = u?.scans ?? 0; const hashes: string[] = u?.code_hashes ?? [];
    if (!hashes.includes(ch) && hashes.length >= s.free_code_limit)
      return withFp(NextResponse.json({ allowed: false, reason: "code_limit", message: `Free plan covers ${s.free_code_limit} script today. Buy a pass for more.` }, { status: 402 }), fp);
    if (scans >= s.free_scan_limit)
      return withFp(NextResponse.json({ allowed: false, reason: "scan_limit", message: `You've used all ${s.free_scan_limit} free scans today. Buy a pass to continue.` }, { status: 402 }), fp);
  }

  const sigs = detectSignals(code);
  if (!sigs.long && !sigs.short) {
    return withFp(NextResponse.json({ allowed: true, ran: false, message: "No trigger found — add an alertcondition/plotshape or name a boolean like `buy` or `short`." }), fp);
  }

  const requested = Number(body.universe) || s.scan_universe_default;
  const universeSize = Math.max(1, Math.min(requested, s.scan_universe_max));

  let result;
  try {
    result = await runScan({ code, longExpr: sigs.long?.expr ?? null, shortExpr: sigs.short?.expr ?? null, exchange, tf, universeSize, filters, minVolume: body.minVolume });
  } catch (e: any) {
    return withFp(NextResponse.json({ allowed: true, ran: false, error: String(e?.message || e).slice(0, 160) }), fp);
  }

  let remaining: number | undefined;
  if (!pass) {
    const ch = codeHash(code); const sql = db();
    const [u] = await sql`select scans, code_hashes from free_usage where identity = ${id} and day = current_date`;
    const hashes: string[] = u?.code_hashes ?? []; const next = hashes.includes(ch) ? hashes : [...hashes, ch];
    await sql`insert into free_usage (identity, day, scans, code_hashes) values (${id}, current_date, 1, ${next})
              on conflict (identity, day) do update set scans = free_usage.scans + 1, code_hashes = ${next}`;
    remaining = Math.max(0, s.free_scan_limit - ((u?.scans ?? 0) + 1));
  }

  return withFp(NextResponse.json({
    allowed: true, ran: true, unlimited: !!pass, remaining,
    hits: result.hits, scanned: result.scanned, timeframe: tf, exchange,
  }), fp);
}
