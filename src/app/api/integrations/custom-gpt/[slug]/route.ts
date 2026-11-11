import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const shared = version.files.filter((f) => f.path.startsWith("instructions/")).map((f) => f.content).join("\n\n");
  const openaiOverlay = version.files.filter((f) => f.path.startsWith("targets/openai/")).map((f) => f.content).join("\n\n");
  const tools = version.files.find((f) => f.path.startsWith("tools/"))?.content ?? "";

  const text = [
    `# Custom GPT instructions — ${skill.name} v${version.version}`,
    `# Exported from SkillVault. Paste into the GPT "Instructions" field.`,
    "",
    shared,
    openaiOverlay ? `\n# Provider overlay (targets/openai)\n\n${openaiOverlay}` : "",
    tools ? `\n# Tools to configure as GPT actions\n\n${tools}` : "",
  ].join("\n");

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${skill.slug}-custom-gpt-instructions.txt"`,
    },
  });
}
