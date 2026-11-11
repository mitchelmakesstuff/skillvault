import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { diffLines, diffStats } from "@/lib/diff";
import { submitReviewAction, reviewDecisionAction, publishAction, restoreVersionAction, runEvalAction } from "@/app/actions/skills";

export default async function VersionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; versionId: string }>;
  searchParams: Promise<{ manifestError?: string; file?: string }>;
}) {
  const { slug, versionId } = await params;
  const { manifestError, file } = await searchParams;
  const ws = await requireWorkspace();
  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: ws.orgId, slug: slug } } });
  if (!skill) notFound();
  const version = await db.skillVersion.findUnique({
    where: { id: versionId },
    include: { files: true, createdBy: true, approvals: { include: { reviewer: true }, orderBy: { createdAt: "desc" } }, evalRuns: { orderBy: { createdAt: "desc" }, include: { results: true } } },
  });
  if (!version || version.skillId !== skill.id) notFound();

  const baseline = version.basedOnId
    ? await db.skillVersion.findUnique({ where: { id: version.basedOnId }, include: { files: true } })
    : await db.skillVersion.findFirst({
        where: { skillId: skill.id, id: { not: version.id }, createdAt: { lt: version.createdAt } },
        orderBy: { createdAt: "desc" },
        include: { files: true },
      });

  const selectedFile = file;
  const baseMap = new Map((baseline?.files ?? []).map((f) => [f.path, f.content]));
  const changedPaths = new Set<string>();
  for (const f of version.files) {
    if (baseMap.get(f.path) !== f.content) changedPaths.add(f.path);
  }
  for (const p of baseMap.keys()) {
    if (!version.files.some((f) => f.path === p)) changedPaths.add(p);
  }
  const paths = [...changedPaths].sort();
  const activePath = selectedFile && changedPaths.has(selectedFile) ? selectedFile : paths[0];
  const before = activePath ? baseMap.get(activePath) ?? "" : "";
  const after = activePath ? version.files.find((f) => f.path === activePath)?.content ?? "" : "";
  const rows = activePath ? diffLines(before, after) : [];
  const stats = diffStats(rows);
  const latestRun = version.evalRuns[0];
  const canReview = can(ws.role, "skill.review") && version.status === "IN_REVIEW";
  const canPublish = version.status === "APPROVED" && can(ws.role, "skill.publish");
  const canOverride = can(ws.role, "admin.override") && version.status !== "PUBLISHED";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/skills/${skill.slug}/versions`} className="text-sm text-slate-400 hover:text-white">
              {skill.slug}
            </Link>
            <span className="font-mono text-xl font-semibold text-white">v{version.version}</span>
            <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{version.branch}</span>
            <StatusBadge status={version.status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{version.changeSummary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {version.createdBy.name} · {version.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            {baseline ? ` · based on v${baseline.version}` : " · initial version"}
          </p>
          {version.riskNotes ? <p className="mt-1 text-xs text-amber-400/80">risk notes: {version.riskNotes}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {version.status === "DRAFT" && can(ws.role, "skill.edit") ? (
            <form action={submitReviewAction}>
              <input type="hidden" name="versionId" value={version.id} />
              <SubmitButton className="btn-secondary" pendingLabel="Submitting…">Submit for review</SubmitButton>
            </form>
          ) : null}
          <form action={runEvalAction}>
            <input type="hidden" name="skillId" value={skill.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <SubmitButton className="btn-secondary" pendingLabel="Running evals…">Run evaluations</SubmitButton>
          </form>
          {version.status !== "PUBLISHED" && can(ws.role, "skill.edit") ? (
            <form action={restoreVersionAction}>
              <input type="hidden" name="versionId" value={version.id} />
              <SubmitButton className="btn-ghost" pendingLabel="Restoring…">Restore as draft</SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {manifestError ? (
        <div className="mb-6 rounded-md border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          Manifest validation warning: {manifestError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 px-4 py-2">
              {paths.length === 0 ? (
                <span className="px-2 py-1 text-xs text-slate-500">No file differences vs baseline.</span>
              ) : (
                paths.map((p) => (
                  <Link
                    key={p}
                    href={`/skills/${skill.slug}/versions/${version.id}?file=${encodeURIComponent(p)}`}
                    className={`rounded px-2 py-1 font-mono text-xs ${p === activePath ? "bg-ink-700 text-white" : "text-slate-400 hover:bg-ink-800"}`}
                  >
                    {p}
                  </Link>
                ))
              )}
            </div>
            {activePath ? (
              <>
                <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-2 font-mono text-xs">
                  <span className="text-slate-400">{activePath}</span>
                  <span className="text-emerald-400">+{stats.added}</span>
                  <span className="text-red-400">−{stats.removed}</span>
                  {!baseMap.has(activePath) ? <span className="text-[10px] uppercase text-slate-600">new file</span> : null}
                </div>
                <div className="overflow-x-auto font-mono text-xs leading-5">
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      className={`flex whitespace-pre-wrap ${
                        r.type === "add" ? "bg-emerald-950/40" : r.type === "del" ? "bg-red-950/40" : ""
                      }`}
                    >
                      <span className="w-10 shrink-0 select-none px-2 text-right text-slate-600">{r.leftNo ?? ""}</span>
                      <span className="w-10 shrink-0 select-none px-2 text-right text-slate-600">{r.rightNo ?? ""}</span>
                      <span className={`shrink-0 select-none px-2 ${r.type === "add" ? "text-emerald-400" : r.type === "del" ? "text-red-400" : "text-slate-700"}`}>
                        {r.type === "add" ? "+" : r.type === "del" ? "−" : " "}
                      </span>
                      <span className={`pr-4 ${r.type === "same" ? "text-slate-400" : "text-slate-200"}`}>{r.type === "add" ? r.right : r.left}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Evaluation evidence</h2>
            {!latestRun ? (
              <p className="mt-2 text-xs text-slate-500">No evaluation run yet. Run evaluations before requesting approval.</p>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <StatusBadge status={latestRun.overallPass ? "PASSED" : "FAILED"} />
                  <span className="text-slate-500">
                    {latestRun.model} · {latestRun.latencyMs}ms · {(latestRun.costMicros ?? 0) / 10000}¢ est.
                  </span>
                </div>
                {latestRun.results.map((r) => (
                  <div key={r.id} className="rounded-md border border-ink-700 bg-ink-850 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">{r.name}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1 text-slate-500">
                      {r.type.toLowerCase()} · score {r.score ?? "—"} · {r.latencyMs ?? 0}ms
                    </div>
                    {r.detail ? <p className="mt-1 text-slate-400">{r.detail}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Review decisions</h2>
            {version.approvals.length > 0 ? (
              <ul className="mt-3 space-y-3 text-xs">
                {version.approvals.map((a) => (
                  <li key={a.id} className="rounded-md border border-ink-700 bg-ink-850 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">{a.reviewer.name}</span>
                      <StatusBadge status={a.decision === "APPROVE" ? "APPROVED" : a.decision === "REJECT" ? "REJECTED" : "PUBLISHED"} />
                    </div>
                    <p className="mt-1 text-slate-400">{a.comment}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No reviews recorded.</p>
            )}

            {canReview ? (
              <form action={reviewDecisionAction} className="mt-4 space-y-2">
                <input type="hidden" name="versionId" value={version.id} />
                <textarea name="comment" className="input h-16 text-xs" placeholder="Review comment (required to reject)" />
                <div className="flex gap-2">
                  <button name="decision" value="APPROVE" className="btn-primary flex-1 text-xs" type="submit">
                    Approve
                  </button>
                  <button name="decision" value="REJECT" className="btn-danger flex-1 text-xs" type="submit">
                    Reject
                  </button>
                </div>
              </form>
            ) : null}

            {canPublish ? (
              <form action={publishAction} className="mt-4 border-t border-ink-800 pt-4">
                <input type="hidden" name="versionId" value={version.id} />
                <SubmitButton className="btn-primary w-full" pendingLabel="Publishing…">
                  Publish release v{version.version}
                </SubmitButton>
              </form>
            ) : null}

            {canOverride && !canPublish ? (
              <details className="mt-4 border-t border-ink-800 pt-4">
                <summary className="cursor-pointer text-xs text-amber-400">Admin override — publish without passing evals</summary>
                <form action={publishAction} className="mt-3 space-y-2">
                  <input type="hidden" name="versionId" value={version.id} />
                  <input name="overrideReason" required className="input text-xs" placeholder="Documented reason (required, audited)" />
                  <SubmitButton className="btn-danger w-full text-xs" pendingLabel="Publishing with override…">
                    Override &amp; publish
                  </SubmitButton>
                </form>
              </details>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
