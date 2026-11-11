import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { runEvalAction } from "@/app/actions/skills";
import { NewTestForm } from "./new-test-form";
import { deleteTestCaseAction } from "@/app/actions/skills";

export default async function TestsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspace();
  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: ws.orgId, slug: slug } } });
  if (!skill) notFound();
  const [testCases, runs, versions] = await Promise.all([
    db.testCase.findMany({ where: { skillId: skill.id }, orderBy: { createdAt: "asc" } }),
    db.evalRun.findMany({
      where: { skillId: skill.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { results: true, version: true, triggeredBy: true },
    }),
    db.skillVersion.findMany({ where: { skillId: skill.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const canRun = can(ws.role, "eval.run");
  const canEdit = can(ws.role, "skill.edit");
  const latestVersion = versions[0];

  return (
    <div>
      <PageHeader title={`Evaluations — ${skill.slug}`} subtitle="Static validation, model-based scoring, and regression runs gate every release.">
        {latestVersion && canRun ? (
          <form action={runEvalAction}>
            <input type="hidden" name="skillId" value={skill.id} />
            <input type="hidden" name="versionId" value={latestVersion.id} />
            <SubmitButton pendingLabel="Running suite…">Run suite on v{latestVersion.version}</SubmitButton>
          </form>
        ) : null}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Test cases</h2>
            <div className="card divide-y divide-ink-800">
              {testCases.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No test cases yet. Publishing will still require the manifest to validate.</p>
              ) : (
                testCases.map((tc) => (
                  <div key={tc.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{tc.name}</span>
                        <span className="badge bg-ink-800 font-mono text-[10px] text-slate-400">{tc.type.toLowerCase()}</span>
                        {tc.required ? <span className="badge bg-amber-500/15 text-amber-300">required gate</span> : null}
                        {tc.modelTarget ? <span className="badge bg-ink-800 font-mono text-[10px] text-slate-400">{tc.modelTarget}</span> : null}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{JSON.stringify(tc.inputs).slice(0, 140)}</p>
                    </div>
                    {canEdit ? (
                      <form action={deleteTestCaseAction}>
                        <input type="hidden" name="testCaseId" value={tc.id} />
                        <button type="submit" className="text-xs text-slate-500 hover:text-red-400">
                          remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Evaluation runs</h2>
            <div className="card divide-y divide-ink-800">
              {runs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No runs yet.</p>
              ) : (
                runs.map((r) => (
                  <Link key={r.id} href={`/skills/${skill.slug}/versions/${r.versionId}`} className="block px-5 py-3 hover:bg-ink-850">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-slate-300">v{r.version.version}</span>
                        <StatusBadge status={r.overallPass ? "PASSED" : "FAILED"} />
                      </div>
                      <span className="text-xs text-slate-500">
                        {r.model} · {r.results.filter((x) => x.status === "PASS").length}/{r.results.length} passed · {r.latencyMs}ms ·{" "}
                        {((r.costMicros ?? 0) / 10000).toFixed(2)}¢
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {r.triggeredBy.name} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        <div>
          {canEdit ? (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-white">Add a test case</h2>
              <NewTestForm skillId={skill.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
