import crypto from "crypto";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/** price + tiny random offset so a pasted tx maps unambiguously to one invoice.
 *  e.g. 5 -> "5.0137". Offset in 0.0001..0.0999 (4 dp, USDT-safe). */
export function uniqueAmount(basePrice: string | number): string {
  const base = Number(basePrice);
  const offset = (crypto.randomInt(1, 999) / 10000); // 0.0001 .. 0.0999
  return (base + offset).toFixed(4);
}
