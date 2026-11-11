import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { forkSkillAction } from "@/app/actions/skills";

export default async function GalleryPage() {
  await requireWorkspace();
  const skills = await db.skill.findMany({
    where: { visibility: "PUBLIC" },
    include: { owner: true, org: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Public skill gallery" subtitle="Skills shared publicly by SkillVault teams. Fork any of them into your workspace as a starting point." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.length === 0 ? (
          <p className="card col-span-full p-10 text-center text-sm text-slate-400">No public skills yet.</p>
        ) : (
          skills.map((s) => {
            return (
              <div key={s.id} className="card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-white">{s.slug}</span>
                  {s.currentVersion ? <span className="font-mono text-[10px] text-slate-500">v{s.currentVersion}</span> : null}
                </div>
                <p className="mt-2 flex-1 text-xs text-slate-400">{s.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {s.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-800 pt-3 text-[11px] text-slate-500">
                  <span>by {s.org.name}</span>
                  {s.license ? <span>{s.license}</span> : null}
                </div>
                <form action={forkSkillAction} className="mt-3">
                  <input type="hidden" name="skillId" value={s.id} />
                  <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Forking…">
                    Fork into workspace
                  </SubmitButton>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
