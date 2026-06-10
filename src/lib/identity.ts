import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { FP_COOKIE } from "./session";

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || "0.0.0.0";
}

/** Stable per-device identity for free metering. NOT bulletproof — IP+fp deters
 *  casual abuse; payment is the real wall. */
export async function getIdentity(): Promise<{ id: string; fp: string }> {
  const h = await headers();
  const c = await cookies();
  let fp = c.get(FP_COOKIE)?.value;
  const isNew = !fp;
  if (!fp) fp = crypto.randomUUID();
  const id = crypto.createHash("sha256").update(`${clientIp(h)}::${fp}`).digest("hex");
  return { id, fp: isNew ? fp : "" }; // fp non-empty signals caller to set the cookie
}

export function codeHash(src: string): string {
  return crypto.createHash("sha256").update(src.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
}
