import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version: versionParam } = await params;
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Provide a valid API key as Bearer token" }, { status: 401 });
  const skill = await db.skill.findUnique({ where: { orgId_slug: { orgId: auth.orgId, slug: slug } } });
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  const version = await db.skillVersion.findFirst({
    where: { skillId: skill.id, version: versionParam },
    include: { files: { select: { path: true, content: true } } },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json({
    slug: skill.slug,
    version: version.version,
    status: version.status,
    changeSummary: version.changeSummary,
    releasedAt: version.publishedAt,
    files: version.files,
  });
}
