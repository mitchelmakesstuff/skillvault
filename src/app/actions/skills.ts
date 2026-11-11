"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/rbac";
import { validateManifest } from "@/lib/manifest";
import { createSkill, saveDraftVersion, submitForReview, decideApproval, publishVersion, restoreVersion, forkSkill, runEvalForVersion } from "@/lib/skills";

export type FormState = { error?: string; success?: string };

function parseModels(formData: FormData): string[] {
  return formData.getAll("models").map(String).filter(Boolean);
}

export async function createSkillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "skill.create")) return { error: "Your role does not allow creating skills." };
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const models = parseModels(formData);
  const visibility = String(formData.get("visibility") ?? "team");
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const ownerTeam = String(formData.get("ownerTeam") ?? "").trim() || ws.orgName.toLowerCase().replace(/\s+/g, "-");
  if (!name || description.length < 10) return { error: "A name and a description of at least 10 characters are required." };
  if (models.length === 0) return { error: "Select at least one model target." };
  const { skill, manifestCheck } = await createSkill({
    orgId: ws.orgId,
    actorId: ws.user.id,
    name,
    description,
    models,
    visibility,
    tags,
    ownerTeam,
  });
  revalidatePath("/skills");
  if (!manifestCheck.ok) {
    redirect(`/skills/${skill.slug}/edit?manifestError=${encodeURIComponent(manifestCheck.errors[0])}`);
  }
  redirect(`/skills/${skill.slug}`);
}

export async function importSkillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "skill.create")) return { error: "Your role does not allow creating skills." };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Attach a .zip skill package." };
  const { readZip, findManifest, stripCommonPrefix } = await import("@/lib/skill-package");
  let files;
  try {
    files = stripCommonPrefix(await readZip(Buffer.from(await file.arrayBuffer())));
  } catch {
    return { error: "Could not read the zip archive." };
  }
  const manifest = findManifest(files);
  if (!manifest) return { error: "The package must contain a skill.yaml manifest." };
  const check = validateManifest(manifest.content);
  if (!check.ok || !check.manifest) return { error: `Invalid skill.yaml: ${check.errors[0]}` };
  const { skill } = await createSkill({
    orgId: ws.orgId,
    actorId: ws.user.id,
    name: check.manifest.name,
    description: check.manifest.description,
    models: check.manifest.models,
    visibility: check.manifest.visibility ?? "team",
    tags: [],
    ownerTeam: check.manifest.owner,
    files: files.filter((f) => f.path !== "skillvault.json"),
  });
  revalidatePath("/skills");
  redirect(`/skills/${skill.slug}`);
}

export async function saveVersionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "skill.edit")) return { error: "Your role does not allow editing skills." };
  const skillId = String(formData.get("skillId") ?? "");
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.orgId !== ws.orgId) return { error: "Skill not found in this workspace." };
  let files: { path: string; content: string }[] = [];
  try {
    files = JSON.parse(String(formData.get("files") ?? "[]"));
  } catch {
    return { error: "Malformed file payload." };
  }
  if (!files.some((f) => f.path === "skill.yaml")) return { error: "skill.yaml is required in every version." };
  const changeSummary = String(formData.get("changeSummary") ?? "").trim();
  if (changeSummary.length < 5) return { error: "A change summary is required before saving a version." };
  const bump = String(formData.get("bump") ?? "patch") as "major" | "minor" | "patch";
  const { version, manifestCheck } = await saveDraftVersion({
    skillId,
    actorId: ws.user.id,
    files,
    changeSummary,
    riskNotes: String(formData.get("riskNotes") ?? "").trim() || undefined,
    bump,
  });
  revalidatePath(`/skills/${skill.slug}`);
  if (!manifestCheck.ok) {
    redirect(`/skills/${skill.slug}/versions/${version.id}?manifestError=${encodeURIComponent(manifestCheck.errors.join(" · "))}`);
  }
  redirect(`/skills/${skill.slug}/versions/${version.id}`);
}

export async function submitReviewAction(formData: FormData) {
  const ws = await requireWorkspace();
  const versionId = String(formData.get("versionId") ?? "");
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: versionId }, include: { skill: true } });
  if (version.skill.orgId !== ws.orgId || !can(ws.role, "skill.edit")) return;
  await submitForReview({ versionId, actorId: ws.user.id });
  revalidatePath(`/skills/${version.skill.slug}/versions/${versionId}`);
  revalidatePath("/reviews");
}

export async function reviewDecisionAction(formData: FormData) {
  const ws = await requireWorkspace();
  const versionId = String(formData.get("versionId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "APPROVE" | "REJECT";
  const comment = String(formData.get("comment") ?? "").trim();
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: versionId }, include: { skill: true } });
  if (version.skill.orgId !== ws.orgId || !can(ws.role, "skill.review")) return;
  if (decision === "REJECT" && comment.length < 5) return;
  await decideApproval({ versionId, reviewerId: ws.user.id, decision, comment: comment || "Approved" });
  revalidatePath(`/skills/${version.skill.slug}/versions/${versionId}`);
  revalidatePath("/reviews");
}

export async function publishAction(formData: FormData) {
  const ws = await requireWorkspace();
  const versionId = String(formData.get("versionId") ?? "");
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: versionId }, include: { skill: true } });
  if (version.skill.orgId !== ws.orgId) return;
  if (overrideReason) {
    if (!can(ws.role, "admin.override")) return;
    await publishVersion({ versionId, actorId: ws.user.id, overrideReason });
  } else {
    if (!can(ws.role, "skill.publish")) return;
    await publishVersion({ versionId, actorId: ws.user.id });
  }
  revalidatePath(`/skills/${version.skill.slug}`);
  redirect(`/skills/${version.skill.slug}`);
}

export async function runEvalAction(formData: FormData) {
  const ws = await requireWorkspace();
  const skillId = String(formData.get("skillId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.orgId !== ws.orgId || !can(ws.role, "eval.run")) return;
  await runEvalForVersion({ skillId, versionId, userId: ws.user.id, model: String(formData.get("model") ?? "") || undefined });
  revalidatePath(`/skills/${skill.slug}/tests`);
  revalidatePath(`/skills/${skill.slug}/versions/${versionId}`);
}

export async function createTestCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ws = await requireWorkspace();
  const skillId = String(formData.get("skillId") ?? "");
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.orgId !== ws.orgId || !can(ws.role, "skill.edit")) return { error: "Not allowed." };
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "STATIC") as "STATIC" | "MODEL" | "REGRESSION";
  const required = formData.get("required") === "on";
  const modelTarget = String(formData.get("modelTarget") ?? "") || null;
  let inputs: unknown = {};
  let expected: unknown = null;
  if (type === "STATIC") {
    const requireFiles = String(formData.get("requireFiles") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    const forbidden = String(formData.get("forbidden") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    inputs = { validateManifest: true, requireFiles, forbidden: forbidden.map((pattern) => ({ pattern })) };
  } else if (type === "MODEL") {
    const variablesRaw = String(formData.get("variables") ?? "{}");
    try {
      inputs = { variables: JSON.parse(variablesRaw) };
    } catch {
      return { error: "Input variables must be valid JSON." };
    }
    const minScore = Number(formData.get("minScore") ?? 0.7);
    const contains = String(formData.get("contains") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    expected = { minScore, contains };
  } else {
    inputs = { baselineVersion: String(formData.get("baselineVersion") ?? "") || undefined };
  }
  if (!name) return { error: "Test name is required." };
  await db.testCase.create({ data: { skillId, name, type, required, modelTarget, inputs: inputs as object, expected: (expected ?? undefined) as never } });
  revalidatePath(`/skills/${skill.slug}/tests`);
  return { success: "Test case created." };
}

export async function deleteTestCaseAction(formData: FormData) {
  const ws = await requireWorkspace();
  const testCaseId = String(formData.get("testCaseId") ?? "");
  const tc = await db.testCase.findUniqueOrThrow({ where: { id: testCaseId }, include: { skill: true } });
  if (tc.skill.orgId !== ws.orgId || !can(ws.role, "skill.edit")) return;
  await db.testCase.delete({ where: { id: testCaseId } });
  revalidatePath(`/skills/${tc.skill.slug}/tests`);
}

export async function restoreVersionAction(formData: FormData) {
  const ws = await requireWorkspace();
  const versionId = String(formData.get("versionId") ?? "");
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: versionId }, include: { skill: true } });
  if (version.skill.orgId !== ws.orgId || !can(ws.role, "skill.edit")) return;
  const result = await restoreVersion({ versionId, actorId: ws.user.id });
  redirect(`/skills/${version.skill.slug}/versions/${result.version.id}`);
}

export async function forkSkillAction(formData: FormData) {
  const ws = await requireWorkspace();
  const skillId = String(formData.get("skillId") ?? "");
  await forkSkill({ skillId, targetOrgId: ws.orgId, actorId: ws.user.id });
  revalidatePath("/skills");
  redirect("/skills");
}

export async function updateSkillMetaAction(formData: FormData) {
  const ws = await requireWorkspace();
  const skillId = String(formData.get("skillId") ?? "");
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.orgId !== ws.orgId || !can(ws.role, "skill.edit")) return;
  const status = String(formData.get("status") ?? skill.status);
  await db.skill.update({
    where: { id: skillId },
    data: {
      description: String(formData.get("description") ?? skill.description),
      visibility: String(formData.get("visibility") ?? skill.visibility) as never,
      status: status as never,
      tags: String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      license: String(formData.get("license") ?? "").trim() || null,
      exampleUsage: String(formData.get("exampleUsage") ?? "").trim() || null,
    },
  });
  revalidatePath(`/skills/${skill.slug}`);
}
