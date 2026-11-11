import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export default async function ReviewsPage() {
  const ws = await requireWorkspace();
  const pending = await db.skillVersion.findMany({
    where: { skill: { orgId: ws.orgId }, status: "IN_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: { skill: true, createdBy: true, evalRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const recent = await db.approval.findMany({
    where: { version: { skill: { orgId: ws.orgId } } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { reviewer: true, version: { include: { skill: true } } },
  });

  return (
    <div>
      <PageHeader title="Review queue" subtitle="Proposed skill changes waiting for a decision, with evaluation evidence attached." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {pending.length === 0 ? (
            <EmptyState title="Queue is clear" body="When an editor submits a version for review it appears here with its diff and evaluation results." />
          ) : (
            <div className="card divide-y divide-ink-800">
              {pending.map((v) => (
                <Link key={v.id} href={`/skills/${v.skill.slug}/versions/${v.id}`} className="block px-5 py-4 hover:bg-ink-850">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{v.skill.name}</span>
                      <span className="font-mono text-xs text-slate-400">v{v.version}</span>
                      {v.evalRuns[0] ? (
                        <StatusBadge status={v.evalRuns[0].overallPass ? "PASSED" : "FAILED"} />
                      ) : (
                        <span className="badge bg-red-500/10 text-red-300">no eval run</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{v.createdAt.toISOString().slice(0, 10)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{v.changeSummary}</p>
                  <p className="mt-1 text-xs text-slate-600">by {v.createdBy.name}{v.riskNotes ? ` · risk: ${v.riskNotes}` : ""}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Recent decisions</h2>
          <div className="card divide-y divide-ink-800 text-xs">
            {recent.length === 0 ? (
              <p className="px-5 py-6 text-slate-400">No decisions recorded yet.</p>
            ) : (
              recent.map((a) => (
                <div key={a.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{a.version.skill.name} v{a.version.version}</span>
                    <StatusBadge status={a.decision === "APPROVE" ? "APPROVED" : a.decision === "REJECT" ? "REJECTED" : "PUBLISHED"} />
                  </div>
                  <p className="mt-1 text-slate-500">{a.reviewer.name}: {a.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
