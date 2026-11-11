import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  const ws = await requireWorkspace();
  const [skills, inReview, releases, failedEvals, audit] = await Promise.all([
    db.skill.findMany({ where: { orgId: ws.orgId }, include: { owner: true } }),
    db.skill.count({ where: { orgId: ws.orgId, status: "IN_REVIEW" } }),
    db.release.findMany({
      where: { skill: { orgId: ws.orgId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { skill: true },
    }),
    db.evalRun.findMany({
      where: { skill: { orgId: ws.orgId }, overallPass: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { version: { include: { skill: true } } },
    }),
    db.auditLog.findMany({ where: { orgId: ws.orgId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const published = skills.filter((s) => s.currentVersion).length;

  return (
    <div>
      <PageHeader title={`${ws.orgName} overview`} subtitle="What is in flight across your skill pipeline right now.">
        <Link href="/skills/new" className="btn-primary">
          New skill
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Skills" value={skills.length} hint={`${published} with a published release`} />
        <Stat label="In review" value={inReview} hint="Waiting on a reviewer" />
        <Stat label="Failed evals" value={failedEvals.length} hint="Recent runs that blocked release" />
        <Stat label="Releases" value={releases.length >= 6 ? "6+" : releases.length} hint="Most recent publishes" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Recent releases</h2>
            {releases.length === 0 ? (
              <p className="card p-6 text-sm text-slate-400">No releases yet. Publish an approved version to see it here.</p>
            ) : (
              <div className="card divide-y divide-ink-800">
                {releases.map((r) => (
                  <Link key={r.id} href={`/skills/${r.skill.slug}/versions/${r.versionId}`} className="flex items-center justify-between px-5 py-3 hover:bg-ink-850">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {r.skill.name} <span className="ml-1 font-mono text-xs text-slate-400">v{r.version}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {r.changedFiles.length} file{r.changedFiles.length === 1 ? "" : "s"} changed · {r.createdAt.toISOString().slice(0, 10)}
                        {r.notes ? " · admin override" : ""}
                      </div>
                    </div>
                    <StatusBadge status="PUBLISHED" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Skills</h2>
            <div className="card divide-y divide-ink-800">
              {skills.slice(0, 8).map((s) => (
                <Link key={s.id} href={`/skills/${s.slug}`} className="flex items-center justify-between px-5 py-3 hover:bg-ink-850">
                  <div>
                    <div className="text-sm font-medium text-white">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.currentVersion ? `v${s.currentVersion}` : "no release"} · owned by {s.owner.name}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Failed evaluations</h2>
            {failedEvals.length === 0 ? (
              <p className="card p-5 text-sm text-slate-400">All recent evaluation runs passed.</p>
            ) : (
              <div className="card divide-y divide-ink-800">
                {failedEvals.map((r) => (
                  <Link key={r.id} href={`/skills/${r.version.skill.slug}/versions/${r.versionId}`} className="block px-5 py-3 hover:bg-ink-850">
                    <div className="text-sm text-white">{r.version.skill.name}</div>
                    <div className="text-xs text-slate-500">v{r.version.version} · {r.model} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Audit trail</h2>
            <div className="card divide-y divide-ink-800 text-xs">
              {audit.map((a) => (
                <div key={a.id} className="px-5 py-2.5">
                  <span className="font-mono text-accent-hover">{a.action}</span>{" "}
                  <span className="text-slate-400">{a.actorEmail ?? "system"}</span>
                  <div className="text-slate-600">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
