import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/identity";
import { getSettings } from "@/db/init";
import { db } from "@/db/sql";
import { activePass } from "@/lib/pass";
import { requireAdmin } from "@/lib/admin";
import { FP_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const pass = (await activePass()) || ((await requireAdmin()) ? { id: "admin", type: "ADMIN", exp: Date.now() + 86400000 } : null);
  const { id, fp } = await getIdentity();
  const settings = await getSettings();
  let remaining = settings.free_scan_limit;
  if (!pass) {
    const [u] = await db()`select scans from free_usage where identity = ${id} and day = current_date`;
    remaining = Math.max(0, settings.free_scan_limit - (u?.scans ?? 0));
  }
  const res = NextResponse.json({ pass: !!pass, remaining, freeScanLimit: settings.free_scan_limit });
  if (fp) res.cookies.set(FP_COOKIE, fp, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
