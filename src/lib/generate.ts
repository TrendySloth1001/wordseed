// Runs a generation request on the server and, where the server can keep
// files, saves the run.
import { getModel, getNeuralModel } from "./corpus";
import { READ_ONLY } from "./deployment";
import { generateRun, type GenerateRequest, type StoredRun } from "./engine";
import { saveRun } from "./runs";

export { MAX_COUNT, MAX_WORDS, UnknownWordError, type GenerateRequest } from "./engine";

export async function generate(request: GenerateRequest): Promise<StoredRun> {
  const stored = await generateRun({ model: await getModel(), neural: getNeuralModel }, request);
  if (!READ_ONLY) await saveRun(stored.run, stored.traces);
  return stored;
}
