import { NextResponse } from "next/server";
import { ensureDb, getSettings } from "@/db/init";
import { db } from "@/db/sql";
import { verifyTx } from "@/payments/verify";
import { newId } from "@/lib/invoice";
import { sign, PASS_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { invoiceId, txHash } = await req.json().catch(() => ({}));
  if (!invoiceId || !txHash) return NextResponse.json({ error: "Missing invoice or tx" }, { status: 400 });
  await ensureDb();
  const sql = db();

  const [inv] = await sql`select * from invoices where id = ${invoiceId}`;
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (inv.status === "PAID") return NextResponse.json({ error: "Invoice already paid" }, { status: 409 });
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    await sql`update invoices set status = 'EXPIRED' where id = ${invoiceId}`;
    return NextResponse.json({ error: "Invoice expired — start a new one" }, { status: 410 });
  }

  // tx must not have been used before
  const [used] = await sql`select tx_hash from used_tx where tx_hash = ${txHash}`;
  if (used) return NextResponse.json({ error: "This transaction was already used" }, { status: 409 });

  const [chain] = await sql`select explorer_api_key from chains where key = ${inv.chain_key}`;
  const s = await getSettings();
  const result = await verifyTx({
    chainKey: inv.chain_key, address: inv.address, expectedAmount: inv.unique_amount,
    txHash, explorerApiKey: chain?.explorer_api_key || undefined, confirmations: s.confirmations_required,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason || "Could not verify payment" }, { status: 422 });

  // grant pass
  const days = inv.plan === "MONTH" ? 30 : 1;
  const passId = newId("pass");
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  await sql.begin(async (tx) => {
    await tx`insert into used_tx (tx_hash, chain_key, amount, invoice_id) values (${txHash}, ${inv.chain_key}, ${result.amount ?? inv.unique_amount}, ${invoiceId})`;
    await tx`insert into passes (id, type, email, identity, invoice_id, expires_at)
             values (${passId}, ${inv.plan}, ${inv.email}, ${inv.identity}, ${invoiceId}, ${new Date(exp)})`;
    await tx`update invoices set status = 'PAID' where id = ${invoiceId}`;
  });

  const res = NextResponse.json({ ok: true, pass: { id: passId, type: inv.plan, expiresAt: new Date(exp).toISOString() } });
  res.cookies.set(PASS_COOKIE, sign({ id: passId, type: inv.plan, exp }), {
    httpOnly: true, sameSite: "lax", maxAge: days * 24 * 60 * 60, path: "/",
  });
  return res;
}
