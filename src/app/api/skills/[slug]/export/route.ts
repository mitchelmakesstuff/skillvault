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

  const skill = await db.skill.findUnique({
    where: { orgId_slug: { orgId: membership.orgId, slug: slug } },
  });
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  const versionId =
    skill.currentVersionId ??
    (await db.skillVersion.findFirst({ where: { skillId: skill.id }, orderBy: { createdAt: "desc" } }))?.id;
  if (!versionId) return NextResponse.json({ error: "Skill has no versions" }, { status: 404 });

  const version = await db.skillVersion.findUnique({ where: { id: versionId }, include: { files: true } });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const manifestYaml = version.files.find((f) => f.path === "skill.yaml")?.content ?? "";
  const zip = await buildZip(
    {
      slug: skill.slug,
      name: skill.name,
      version: version.version,
      exportedAt: new Date().toISOString(),
      license: skill.license,
      manifestYaml,
    },
    version.files.map((f) => ({ path: f.path, content: f.content }))
  );
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${skill.slug}-${version.version}.zip"`,
    },
  });
}
