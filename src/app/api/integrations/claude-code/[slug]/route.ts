import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildZip } from "@/lib/skill-package";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const membership = user.memberships[0];
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: membership.orgId, slug: slug } } });
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  const versionId =
    skill.currentVersionId ??
    (await db.skillVersion.findFirst({ where: { skillId: skill.id }, orderBy: { createdAt: "desc" } }))?.id;
  if (!versionId) return NextResponse.json({ error: "No versions" }, { status: 404 });
  const version = await db.skillVersion.findUnique({ where: { id: versionId }, include: { files: true } });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const instructions = version.files
    .filter((f) => f.path.startsWith("instructions/"))
    .map((f) => f.content)
    .join("\n\n");
  const claudeOverlay = version.files.filter((f) => f.path.startsWith("targets/claude/"));
  const skillMd = `---
name: ${skill.slug}
description: ${skill.description.replace(/\n/g, " ")}
version: ${version.version}
---

${instructions}

${claudeOverlay.map((f) => f.content).join("\n\n")}
`;

  const files = [{ path: "SKILL.md", content: skillMd }];
  for (const f of version.files) {
    if (f.path === "skill.yaml" || f.path.startsWith("instructions/") || f.path.startsWith("targets/claude/")) continue;
    files.push({ path: f.path, content: f.content });
  }

  const zip = await buildZip({ format: "claude-code-skill-directory", slug: skill.slug, version: version.version }, files);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${skill.slug}-claude-code.zip"`,
    },
  });
}
