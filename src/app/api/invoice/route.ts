import { NextResponse } from "next/server";
import { ensureDb, getSettings } from "@/db/init";
import { db } from "@/db/sql";
import { getIdentity } from "@/lib/identity";
import { newId, uniqueAmount } from "@/lib/invoice";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { plan, chainKey, email } = await req.json().catch(() => ({}));
  if (plan !== "DAY" && plan !== "MONTH") return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  await ensureDb();
  const sql = db();
  const [chain] = await sql`select key, label, address from chains where key = ${chainKey} and enabled = true and address <> ''`;
  if (!chain) return NextResponse.json({ error: "Chain not available" }, { status: 400 });

  const s = await getSettings();
  const base = plan === "DAY" ? s.day_pass_price : s.month_pass_price;
  const amount = uniqueAmount(base);
  const id = newId("inv");
  const { id: identity } = await getIdentity();
  const expiresAt = new Date(Date.now() + s.invoice_expiry_minutes * 60_000);

  await sql`insert into invoices (id, plan, chain_key, address, base_price, unique_amount, email, identity, expires_at)
            values (${id}, ${plan}, ${chain.key}, ${chain.address}, ${base}, ${amount}, ${email ?? null}, ${identity}, ${expiresAt})`;

  return NextResponse.json({
    invoiceId: id, plan, chainKey: chain.key, chainLabel: chain.label,
    address: chain.address, amount, expiresAt: expiresAt.toISOString(),
  });
}
