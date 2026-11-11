import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function VersionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspace();
  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: ws.orgId, slug: slug } } });
  if (!skill) notFound();
  const versions = await db.skillVersion.findMany({
    where: { skillId: skill.id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true, evalRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const publishedIds = new Set(versions.filter((v) => v.status === "PUBLISHED").map((v) => v.id));

  return (
    <div>
      <PageHeader title={`Version history — ${skill.slug}`} subtitle="Immutable versions on every branch. The current release is what consumers receive.">
        <Link href={`/skills/${skill.slug}/edit`} className="btn-secondary">
          Edit source
        </Link>
      </PageHeader>

      <div className="card divide-y divide-ink-800">
        {versions.map((v) => (
          <Link key={v.id} href={`/skills/${skill.slug}/versions/${v.id}`} className="block px-5 py-4 hover:bg-ink-850">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-white">v{v.version}</span>
                <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{v.branch}</span>
                <StatusBadge status={v.status} />
                {skill.currentVersionId === v.id ? <span className="badge bg-accent/15 text-accent-hover">current</span> : null}
              </div>
              <span className="text-xs text-slate-500">
                {v.createdBy.name} · {v.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{v.changeSummary}</p>
            {v.riskNotes ? <p className="mt-1 text-xs text-amber-400/80">risk: {v.riskNotes}</p> : null}
            <div className="mt-1.5 text-xs text-slate-600">
              {v.evalRuns[0] ? `eval: ${v.evalRuns[0].overallPass ? "passed" : "failed"} (${v.evalRuns[0].model})` : "no evaluation run"}
              {publishedIds.has(v.id) ? " · released" : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
