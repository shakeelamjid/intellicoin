import { detectKind, detectSignals, analyzeCalls, coverage } from "@/engine/pinets";
import { describe } from "@/engine/describe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams REAL analysis stages as NDJSON lines — each emitted when the work
 *  is actually done (no fake progress). */
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(c) {
      const send = (obj: unknown) => c.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        if (!code || typeof code !== "string" || code.trim().length < 10) {
          send({ stage: "error", message: "Paste a Pine script first." }); c.close(); return;
        }
        send({ stage: "start" });

        // 1 — version + kind
        const version = (code.match(/@version\s*=\s*(\d+)/) || [])[1] || null;
        const kind = detectKind(code);
        send({ stage: "kind", version, kind });

        // 2 — function inventory vs PineTS coverage index
        const { recognized, unknown } = analyzeCalls(code);
        send({
          stage: "functions",
          total: recognized.length,
          supported: recognized.filter((r) => r.supported).map((r) => r.name),
          unsupported: recognized.filter((r) => !r.supported).map((r) => r.name),
          unknown,
        });

        // 3 — signals (long / short)
        const sigs = detectSignals(code);
        send({ stage: "signals", long: sigs.long, short: sigs.short });

        // 4 — live engine test (real run on synthetic candles)
        const cov = await coverage(code);
        send({ stage: "engine", ran: cov.faithfulnessPct > 0 && cov.supported || cov.understoodPct >= 95, understoodPct: cov.understoodPct, faithfulnessPct: cov.faithfulnessPct, unsupported: cov.unsupported });

        // 5 — plain-English understanding
        send({ stage: "read", read: describe(code) });

        send({ stage: "done", coverage: cov, signals: sigs, version, kind });
      } catch (e: any) {
        send({ stage: "error", message: String(e?.message || e).slice(0, 160) });
      } finally { c.close(); }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
