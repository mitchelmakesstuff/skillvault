import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    status: "stub",
    message: "Git sync prototype. POST a repository archive URL (GitHub/GitLab) plus a target skill slug; SkillVault will unzip it, validate skill.yaml, and open a draft version for review.",
    received: body,
    plannedFlow: [
      "1. fetch archive from repo (deploy key or OAuth token)",
      "2. readZip -> validate manifest",
      "3. saveDraftVersion(basedOn latest)",
      "4. notify reviewers via webhook",
    ],
  });
}
