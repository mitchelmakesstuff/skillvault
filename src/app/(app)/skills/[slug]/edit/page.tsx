import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { EditorClient } from "./editor-client";

export default async function EditSkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspace();
  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: ws.orgId, slug: slug } } });
  if (!skill) notFound();
  if (!can(ws.role, "skill.edit")) {
    return <p className="card p-6 text-sm text-slate-400">Your role ({ws.role}) cannot edit skills. Ask an Editor or Admin.</p>;
  }
  const base = skill.currentVersionId
    ? await db.skillVersion.findUnique({ where: { id: skill.currentVersionId }, include: { files: true } })
    : await db.skillVersion.findFirst({ where: { skillId: skill.id, branch: "main" }, orderBy: { createdAt: "desc" }, include: { files: true } });

  return (
    <div>
      <PageHeader
        title={`Edit ${skill.slug}`}
        subtitle={`Editing from ${base ? `v${base.version}` : "empty"}. Saving creates a new immutable draft version — nothing changes until it is reviewed and released.`}
      />
      <EditorClient
        skillId={skill.id}
        slug={skill.slug}
        initialFiles={base ? base.files.map((f) => ({ path: f.path, content: f.content })) : []}
        canPublish={can(ws.role, "skill.publish")}
      />
    </div>
  );
}
