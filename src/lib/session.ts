import crypto from "crypto";
export { ADMIN_COOKIE, PASS_COOKIE, FP_COOKIE } from "./cookies";

function secret() { return process.env.SESSION_SECRET || "dev-insecure-secret-change-me"; }
function b64url(buf: Buffer) { return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

export function sign(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${mac}`;
}
export function verify<T = Record<string, unknown>>(token: string | undefined): T | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as T; }
  catch { return null; }
}
export function isAdminToken(token: string | undefined): boolean {
  const p = verify<{ role: string; exp: number }>(token);
  return !!p && p.role === "admin" && p.exp > Date.now();
}
