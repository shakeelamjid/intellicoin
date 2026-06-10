import { NextResponse } from "next/server";
import { coverage } from "@/engine/pinets";
import { describe } from "@/engine/describe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (!code || typeof code !== "string") return NextResponse.json({ error: "No code" }, { status: 400 });
  try {
    const cov = await coverage(code);
    return NextResponse.json({ ...cov, read: describe(code) });
  } catch (e: any) {
    return NextResponse.json({ kind: "unknown", supported: false, understoodPct: 0, faithfulnessPct: 0, signal: null, unsupported: [String(e?.message || e).slice(0, 140)], read: "We couldn't read this script." });
  }
}
