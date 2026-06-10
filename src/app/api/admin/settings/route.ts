import { NextResponse } from "next/server";
import { ensureDb, getSettings } from "@/db/init";
import { db } from "@/db/sql";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDb();
  const b = await req.json().catch(() => ({}));
  await db()`
    update settings set
      free_scan_limit = ${Number(b.free_scan_limit)},
      free_code_limit = ${Number(b.free_code_limit)},
      day_pass_price = ${String(b.day_pass_price)},
      month_pass_price = ${String(b.month_pass_price)},
      confirmations_required = ${Number(b.confirmations_required)},
      invoice_expiry_minutes = ${Number(b.invoice_expiry_minutes)},
      scan_universe_default = ${Number(b.scan_universe_default)},
      scan_universe_max = ${Number(b.scan_universe_max)},
      updated_at = now()
    where id = 1`;
  return NextResponse.json(await getSettings());
}
