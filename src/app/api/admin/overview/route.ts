import { NextResponse } from "next/server";
import { ensureDb } from "@/db/init";
import { db } from "@/db/sql";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDb();
  const sql = db();
  const [[passes], [paid], [pending], recentPasses, recentTx] = await Promise.all([
    sql`select count(*)::int as n from passes where expires_at > now()`,
    sql`select count(*)::int as n from invoices where status = 'PAID'`,
    sql`select count(*)::int as n from invoices where status = 'PENDING'`,
    sql`select id, type, email, created_at, expires_at from passes order by created_at desc limit 10`,
    sql`select tx_hash, chain_key, amount, verified_at from used_tx order by verified_at desc limit 10`,
  ]);
  return NextResponse.json({
    activePasses: passes.n, paidInvoices: paid.n, pendingInvoices: pending.n,
    recentPasses, recentTx,
  });
}
