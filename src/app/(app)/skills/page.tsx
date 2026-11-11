import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { PageHeader, StatusBadge, VisibilityBadge } from "@/components/ui";
import { ImportForm } from "./import-form";

const STATUSES = ["", "DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED", "ARCHIVED"];

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; tag?: string; target?: string }> }) {
  const { q: qParam, status, tag, target } = await searchParams;
  const ws = await requireWorkspace();
  const q = (qParam ?? "").toLowerCase();

  const skills = await db.skill.findMany({
    where: { orgId: ws.orgId },
    include: { owner: true, versions: { where: { branch: "main" }, select: { version: true, status: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const allTags = [...new Set(skills.flatMap((s) => s.tags))].sort();

  const filtered = skills.filter((s) => {
    if (q && !(`${s.name} ${s.description} ${s.slug}`.toLowerCase().includes(q))) return false;
    if (status && s.status !== status) return false;
    if (tag && !s.tags.includes(tag)) return false;
    if (target) {
      const manifest = s.versions.length ? true : false;
      if (!manifest) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Skill library" subtitle="Every AI capability in this workspace, with its release state.">
        <Link href="/skills/new" className="btn-primary">
          New skill
        </Link>
      </PageHeader>

      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <div className="w-64">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={qParam} className="input" placeholder="name, description, tag…" />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s ? s.replace(/_/g, " ").toLowerCase() : "any"}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="label" htmlFor="tag">Tag</label>
          <select id="tag" name="tag" defaultValue={tag} className="input">
            <option value="">any</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card divide-y divide-ink-800">
            {filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No skills match these filters.</p>
            ) : (
              filtered.map((s) => (
                <Link key={s.id} href={`/skills/${s.slug}`} className="block px-5 py-4 hover:bg-ink-850">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm text-white">{s.slug}</div>
                    <div className="flex items-center gap-2">
                      <VisibilityBadge visibility={s.visibility} />
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{s.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>v{s.currentVersion ?? "0.0.0-draft"}</span>
                    <span>·</span>
                    <span>{s.owner.name}</span>
                    {s.tags.map((t) => (
                      <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-slate-400">{t}</span>
                    ))}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">Import a skill package</h3>
            <p className="mt-1 text-xs text-slate-400">
              Upload a .zip containing a <span className="code">skill.yaml</span> manifest. Works with exports from SkillVault
              or a Git repository archive.
            </p>
            <ImportForm />
          </div>
          <div className="card p-5 text-xs text-slate-400">
            <h3 className="text-sm font-semibold text-white">Package layout</h3>
            <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-400">{`skill.yaml
instructions/
assets/
tools/
tests/
targets/<model>/
releases/`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}


