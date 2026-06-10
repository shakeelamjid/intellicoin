import { NextResponse } from "next/server";
import { getSettings } from "@/db/init";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    dayPassPrice: s.day_pass_price, monthPassPrice: s.month_pass_price,
    freeScanLimit: s.free_scan_limit, freeCodeLimit: s.free_code_limit,
    invoiceExpiryMinutes: s.invoice_expiry_minutes,
    scanUniverseDefault: s.scan_universe_default,
    scanUniverseMax: s.scan_universe_max,
  });
}
