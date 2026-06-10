import { NextResponse } from "next/server";
import { ensureDb } from "@/db/init";
import { db } from "@/db/sql";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDb();
  const rows = await db()`select key, label, address, explorer_api_key, enabled, sort from chains order by sort`;
  return NextResponse.json({ chains: rows });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDb();
  const { chains } = await req.json().catch(() => ({ chains: [] }));
  const sql = db();
  for (const c of chains ?? []) {
    await sql`update chains set address = ${c.address ?? ""}, explorer_api_key = ${c.explorer_api_key ?? ""}, enabled = ${!!c.enabled} where key = ${c.key}`;
  }
  const rows = await sql`select key, label, address, explorer_api_key, enabled, sort from chains order by sort`;
  return NextResponse.json({ chains: rows });
}
