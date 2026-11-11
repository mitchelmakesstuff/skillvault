import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { createSkill } from "@/lib/skills";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const membership = user.memberships[0];
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 400 });
  if (!can(membership.role as never, "skill.create")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const models = Array.isArray(body?.models) ? body.models.map(String) : [];
  if (!name || description.length < 10 || models.length === 0) {
    return NextResponse.json({ error: "name, description (10+ chars), and at least one model are required" }, { status: 400 });
  }
  const { skill } = await createSkill({
    orgId: membership.orgId,
    actorId: user.id,
    name,
    description,
    models,
    visibility: String(body?.visibility ?? "team"),
    tags: Array.isArray(body?.tags) ? body.tags.map(String) : [],
    ownerTeam: String(body?.ownerTeam ?? membership.org.slug),
  });
  await logAudit({ orgId: membership.orgId, actorId: user.id, action: "skill.created", targetType: "skill", targetId: skill.id, metadata: { via: "api" } });
  return NextResponse.json({ slug: skill.slug, id: skill.id }, { status: 201 });
}
