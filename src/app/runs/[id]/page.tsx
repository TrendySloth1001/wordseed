import type { Metadata } from "next";
import { getRun } from "@/lib/runs";
import { LocalRun, RunPageBody } from "./run-page-body";

export const metadata: Metadata = { title: "Saved run" };

export default async function RunPage(props: PageProps<"/runs/[id]">) {
  const { id } = await props.params;
  const run = await getRun(id);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      {run ? (
        <RunPageBody
          run={run}
          when={new Date(run.time).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
        />
      ) : (
        // Not on the server: it may be one of the runs kept in this browser.
        <LocalRun id={id} />
      )}
    </main>
  );
}
