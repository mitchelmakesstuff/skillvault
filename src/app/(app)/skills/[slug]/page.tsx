import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { StatusBadge, VisibilityBadge, ModelBadge, SeverityBadge } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { parse } from "yaml";
import { scanPortability, targetCoverage } from "@/lib/portability";
import { forkSkillAction } from "@/app/actions/skills";

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspace();
  const skill = await db.skill.findUnique({
    where: { orgId_slug: { orgId: ws.orgId, slug: slug } },
    include: {
      owner: true,
      releases: { orderBy: { createdAt: "desc" }, take: 5, include: { evalRun: true } },
      testCases: true,
      versions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!skill) notFound();

  const current = skill.currentVersionId
    ? await db.skillVersion.findUnique({ where: { id: skill.currentVersionId }, include: { files: true } })
    : null;
  const latestDraft = await db.skillVersion.findFirst({
    where: { skillId: skill.id, status: { in: ["DRAFT", "IN_REVIEW", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
  });
  const files = current?.files ?? [];
  const readme = files.find((f) => f.path.startsWith("instructions/")) ?? files.find((f) => f.path.endsWith(".md"));
  let manifest: Record<string, unknown> | null = null;
  const manifestFile = files.find((f) => f.path === "skill.yaml");
  if (manifestFile) {
    try {
      manifest = parse(manifestFile.content) as Record<string, unknown>;
    } catch {}
  }
  const models = (manifest?.models as string[] | undefined) ?? [];
  const risks = files.length ? scanPortability(files.map((f) => ({ path: f.path, content: f.content }))) : [];
  const coverage = models.length && files.length ? targetCoverage(models, files.map((f) => ({ path: f.path }))) : [];
  const editable = can(ws.role, "skill.edit");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold text-white">{skill.slug}</h1>
            <VisibilityBadge visibility={skill.visibility} />
            <StatusBadge status={skill.status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{skill.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>current release: {skill.currentVersion ? <span className="font-mono text-slate-300">v{skill.currentVersion}</span> : "none"}</span>
            <span>·</span>
            <span>owner {skill.owner.name}</span>
            {skill.tags.map((t) => (
              <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-slate-400">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Link href={`/skills/${skill.slug}/edit`} className="btn-secondary">
              Edit source
            </Link>
          ) : null}
          <Link href={`/skills/${skill.slug}/tests`} className="btn-secondary">
            Evaluations
          </Link>
          <Link href={`/skills/${skill.slug}/versions`} className="btn-primary">
            Versions {latestDraft && latestDraft.status !== "PUBLISHED" ? <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">{latestDraft.status === "IN_REVIEW" ? "in review" : "draft"}</span> : null}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="text-sm font-semibold text-white">Instructions preview</h2>
            <div className="mt-3">
              {readme ? <Markdown source={readme.content} /> : <p className="text-sm text-slate-400">No instruction file yet.</p>}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-sm font-semibold text-white">Release history</h2>
            {skill.releases.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No releases published yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-ink-800">
                {skill.releases.map((r) => (
                  <Link key={r.id} href={`/skills/${skill.slug}/versions/${r.versionId}`} className="flex items-center justify-between py-3 hover:text-white">
                    <div>
                      <span className="font-mono text-sm text-white">v{r.version}</span>
                      <span className="ml-3 text-xs text-slate-500">
                        {r.changedFiles.length} files · {r.createdAt.toISOString().slice(0, 10)}
                        {r.evalRun ? ` · eval ${r.evalRun.overallPass ? "passed" : "failed"}` : ""}
                        {r.notes ? " · overridden" : ""}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">view diff →</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Model targets</h2>
            <p className="mt-1 text-xs text-slate-500">● marks a provider-specific overlay under targets/.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {models.length === 0 ? <span className="text-xs text-slate-500">No manifest yet</span> : null}
              {coverage.map((c) => (
                <ModelBadge key={c.target} model={c.target} overlay={c.hasOverlay} />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Portability risks</h2>
            {risks.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No provider-specific patterns detected in shared content.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {risks.slice(0, 6).map((r, i) => (
                  <li key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={r.severity} />
                      <span className="font-mono text-slate-400">{r.file}</span>
                    </div>
                    <p className="mt-1 text-slate-400">{r.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Manifest</h2>
            {manifest ? (
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-slate-500">inputs</dt><dd className="text-slate-300">{(manifest.inputs as unknown[] | undefined)?.length ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">outputs</dt><dd className="text-slate-300">{(manifest.outputs as unknown[] | undefined)?.length ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">tools</dt><dd className="font-mono text-slate-300">{((manifest.tools as string[]) ?? []).join(", ") || "none"}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">tests</dt><dd className="text-slate-300">{skill.testCases.length} cases</dd></div>
                {skill.license ? <div className="flex justify-between"><dt className="text-slate-500">license</dt><dd className="text-slate-300">{skill.license}</dd></div> : null}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No manifest in current release.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Use this skill</h2>
            <div className="mt-3 space-y-2 text-xs">
              <a href={`/api/skills/${skill.slug}/export`} className="block text-accent-hover hover:underline">↓ Export portable package (.zip)</a>
              <a href={`/api/integrations/claude-code/${skill.slug}`} className="block text-accent-hover hover:underline">↓ Export Claude Code skill directory</a>
              <a href={`/api/integrations/custom-gpt/${skill.slug}`} className="block text-accent-hover hover:underline">↓ Export Custom GPT instructions</a>
              <button type="submit" form="fork-form" className="text-accent-hover hover:underline">⑂ Fork into this workspace</button>
            </div>
            <form id="fork-form" action={forkSkillAction}>
              <input type="hidden" name="skillId" value={skill.id} />
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
