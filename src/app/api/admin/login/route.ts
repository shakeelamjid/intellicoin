import { NextResponse } from "next/server";
import crypto from "crypto";
import { sign, ADMIN_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

function eq(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const okEmail = process.env.ADMIN_EMAIL || "admin@intellicoin.local";
  const okPass = process.env.ADMIN_PASSWORD || "changeme";
  if (!email || !password || !eq(email, okEmail) || !eq(password, okPass)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sign({ role: "admin", exp }), { httpOnly: true, sameSite: "lax", maxAge: 8 * 3600, path: "/" });
  return res;
}
