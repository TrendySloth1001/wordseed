import { deleteRun, getRun } from "@/lib/runs";

const missing = () => Response.json({ error: "That run no longer exists." }, { status: 404 });

export async function GET(_request: Request, context: RouteContext<"/api/runs/[id]">) {
  const { id } = await context.params;
  const run = await getRun(id);
  return run ? Response.json(run) : missing();
}

export async function DELETE(_request: Request, context: RouteContext<"/api/runs/[id]">) {
  const { id } = await context.params;
  return (await deleteRun(id)) ? Response.json({ deleted: id }) : missing();
}
