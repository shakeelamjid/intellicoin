/**
 * Tx verification. Default mode = "mock" so the whole pay flow works locally
 * before you add explorer API keys. Set PAYMENTS_MODE=live in production.
 *
 * A real verification must confirm ALL of:
 *  1) tx exists and is confirmed (>= confirmationsRequired)
 *  2) it's a USDT transfer of >= expected amount
 *  3) recipient == your configured address
 *  4) (caller) tx hash not already used  -> enforced in the route via used_tx
 *  5) (optional) recent enough
 */

export interface VerifyInput {
  chainKey: string;
  address: string;        // your receiving address
  expectedAmount: string; // exact unique amount, e.g. "5.0137"
  txHash: string;
  explorerApiKey?: string;
  confirmations: number;
}
export interface VerifyResult { ok: boolean; reason?: string; amount?: string }

// USDT contract per chain (used by live adapters)
const USDT = {
  trc20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  erc20: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  bep20: "0x55d398326f99059fF775485246999027B3197955",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
} as const;

function ge(a: string, b: string) {
  return Number(a) + 1e-9 >= Number(b);
}

/** MOCK: accept any non-empty hash and echo the expected amount.
 *  Use txHash "fail" to simulate a rejection while testing. */
async function mockVerify(input: VerifyInput): Promise<VerifyResult> {
  if (!input.txHash || input.txHash.trim().length < 6) return { ok: false, reason: "Enter a valid transaction hash" };
  if (input.txHash.trim().toLowerCase() === "fail") return { ok: false, reason: "Payment not found or unconfirmed" };
  return { ok: true, amount: input.expectedAmount };
}

/** LIVE (Tron / TRC-20) via Tronscan public API. Best-effort; test before relying on it. */
async function tronVerify(input: VerifyInput): Promise<VerifyResult> {
  try {
    const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(input.txHash)}`;
    const r = await fetch(url, { headers: input.explorerApiKey ? { "TRON-PRO-API-KEY": input.explorerApiKey } : {} });
    if (!r.ok) return { ok: false, reason: "Explorer unreachable" };
    const t = await r.json();
    if (t.confirmed !== true && (t.confirmations ?? 0) < input.confirmations) return { ok: false, reason: "Not enough confirmations yet" };
    const tr = t.trc20TransferInfo || (t.tokenTransferInfo ? [t.tokenTransferInfo] : []);
    const hit = (Array.isArray(tr) ? tr : []).find(
      (x: any) => (x.contract_address || x.contractAddress) === USDT.trc20 && (x.to_address || x.to) === input.address,
    );
    if (!hit) return { ok: false, reason: "No USDT transfer to your address in this tx" };
    const amount = (Number(hit.amount_str ?? hit.amount) / 1e6).toFixed(4);
    if (!ge(amount, input.expectedAmount)) return { ok: false, reason: `Amount ${amount} is less than ${input.expectedAmount}` };
    return { ok: true, amount };
  } catch {
    return { ok: false, reason: "Verification error" };
  }
}

/** ETH/BSC/Polygon adapters: same shape via an Etherscan-family API.
 *  Left as a clear integration point — wire the per-chain base URL + key, then
 *  check token == USDT[chain], to == address, value >= expected, confirmations. */
async function evmVerify(_input: VerifyInput): Promise<VerifyResult> {
  return { ok: false, reason: "Live EVM verification not configured yet — use mock mode or wire the explorer adapter" };
}

export async function verifyTx(input: VerifyInput): Promise<VerifyResult> {
  if ((process.env.PAYMENTS_MODE || "mock") !== "live") return mockVerify(input);
  if (input.chainKey === "trc20") return tronVerify(input);
  return evmVerify(input);
}
