import { listSources, loadNeuralFiles, offlineManifest, readSource } from "@/lib/corpus";

/**
 * The files a browser saves to run both models offline:
 * - manifest: what there is and its version
 * - corpus:   every corpus text
 * - neural:   the LSTM's manifest (model.json)
 * - weights:  the LSTM's weights (model.bin)
 */
export async function GET(_request: Request, context: RouteContext<"/api/offline/[part]">) {
  const { part } = await context.params;
  switch (part) {
    case "manifest":
      return Response.json(await offlineManifest(), { headers: { "Cache-Control": "no-store" } });
    case "corpus": {
      const sources = await listSources();
      const names = sources.map((source) => source.name.replace(/\.txt$/, ""));
      const texts = await Promise.all(names.map(async (name) => (await readSource(name)) ?? ""));
      return Response.json({ sources, texts });
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
