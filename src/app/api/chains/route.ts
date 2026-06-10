import { NextResponse } from "next/server";
import { ensureDb } from "@/db/init";
import { db } from "@/db/sql";
export const dynamic = "force-dynamic";
export async function GET() {
  await ensureDb();
  const rows = await db()`select key, label, address from chains where enabled = true and address <> '' order by sort`;
  return NextResponse.json({ chains: rows });
}
