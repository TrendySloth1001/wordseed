import { loadNeuralFiles, offlineManifest, readSource } from "@/lib/corpus";

/**
 * What a browser saves to run both models offline:
 * - manifest:          what there is, where to get it, and its version
 * - corpus?name=…:     one corpus text
 * - neural, weights:   the LSTM's manifest (model.json) and weights (model.bin)
 * On a read-only host the manifest points at static copies instead.
 */
export async function GET(request: Request, context: RouteContext<"/api/offline/[part]">) {
  const { part } = await context.params;
  switch (part) {
    case "manifest":
      return Response.json(await offlineManifest(), { headers: { "Cache-Control": "no-store" } });
    case "corpus": {
      const name = new URL(request.url).searchParams.get("name") ?? "";
      const text = name ? await readSource(name) : null;
      if (text === null) return Response.json({ error: "No such source." }, { status: 404 });
      return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    case "neural":
    case "weights": {
      const files = await loadNeuralFiles();
      if (!files) return Response.json({ error: "The neural model has not been trained." }, { status: 404 });
      return part === "neural"
        ? Response.json(files.manifest)
        : new Response(files.weights, { headers: { "Content-Type": "application/octet-stream" } });
    }
  }
  return Response.json({ error: "Unknown part." }, { status: 404 });
}
