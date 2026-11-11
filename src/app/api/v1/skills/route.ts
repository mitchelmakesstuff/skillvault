import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Provide a valid API key as Bearer token" }, { status: 401 });
  const skills = await db.skill.findMany({
    where: { orgId: auth.orgId, currentVersion: { not: null } },
    select: { slug: true, name: true, description: true, status: true, currentVersion: true, tags: true },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json({ skills });
}
