import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminToken } from "./session";

export async function requireAdmin(): Promise<boolean> {
  const c = await cookies();
  return isAdminToken(c.get(ADMIN_COOKIE)?.value);
}
