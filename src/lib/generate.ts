// Runs a generation request on the server and saves the run.
import { getModel, getNeuralModel } from "./corpus";
import { generateRun, type GenerateRequest } from "./engine";
import type { Run } from "./run-types";
import { saveRun } from "./runs";

export { MAX_COUNT, MAX_WORDS, UnknownWordError, type GenerateRequest } from "./engine";

export async function generate(request: GenerateRequest): Promise<Run> {
  const { run, traces } = await generateRun({ model: await getModel(), neural: getNeuralModel }, request);
  await saveRun(run, traces);
  return run;
}
