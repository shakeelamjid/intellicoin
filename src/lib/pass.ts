import { cookies } from "next/headers";
import { PASS_COOKIE, verify } from "./session";

export async function activePass(): Promise<{ id: string; type: string; exp: number } | null> {
  const c = await cookies();
  const p = verify<{ id: string; type: string; exp: number }>(c.get(PASS_COOKIE)?.value);
  if (p && p.exp > Date.now()) return p;
  return null;
}
