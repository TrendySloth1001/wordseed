import {
  deleteUpload,
  getModel,
  getNeuralModel,
  listSources,
  MAX_UPLOAD_BYTES,
  saveUpload,
} from "@/lib/corpus";

/** The corpus files plus what both models learned from them. */
async function summary() {
  const [sources, model, neural] = await Promise.all([listSources(), getModel(), getNeuralModel()]);
  return {
    sources,
    stats: model.stats,
    statistics: model.corpusStatistics(),
    neural: neural && { vocabulary: neural.vocabulary.length, perplexity: neural.perplexity },
  };
}

export async function GET() {
  return Response.json(await summary());
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach a .txt file." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".txt")) {
    return Response.json({ error: "Only plain .txt files can be added." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `The file must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      { status: 400 },
    );
  }
  const text = await file.text();
  if (text.includes("\0")) {
    return Response.json({ error: "That file is not plain text." }, { status: 400 });
  }
  if (!(await saveUpload(file.name, text))) {
    return Response.json({ error: "That file name cannot be used." }, { status: 400 });
  }
  return Response.json(await summary());
}

export async function DELETE(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!(await deleteUpload(name))) {
    return Response.json({ error: "No uploaded file with that name." }, { status: 404 });
  }
  return Response.json(await summary());
}
