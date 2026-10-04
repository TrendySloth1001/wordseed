import { getModel, getNeuralModel } from "@/lib/corpus";
import { explainTrace } from "@/lib/engine";
import type { Run, Trace } from "@/lib/run-types";

/**
 * Explains one sentence from its trace, sent by the browser. Used for runs the
 * browser keeps itself, which the server never saw saved.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const engine = body?.engine === "neural" ? "neural" : "markov";
  const trace = body?.trace as Trace | undefined;
  const valid =
    Array.isArray(trace?.tokens) &&
    trace.tokens.length > 0 &&
    trace.tokens.length <= 200 &&
    trace.tokens.every((token: unknown) => typeof token === "string" && token.length <= 100) &&
    Number.isInteger(trace.seed) &&
    trace.seed >= 0 &&
    trace.seed < trace.tokens.length &&
    (trace.orders === undefined ||
      (Array.isArray(trace.orders) && trace.orders.every((order: unknown) => Number.isInteger(order))));
  if (!valid) return Response.json({ error: "Send the sentence's trace to explain it." }, { status: 400 });

  const detail = await explainTrace(
    { model: await getModel(), neural: getNeuralModel },
    { run: { engine } as Run, traces: [trace!] },
    0,
  );
  return detail ? Response.json(detail) : Response.json({ error: "That sentence cannot be explained." }, { status: 404 });
}
