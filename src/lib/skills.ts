import "server-only";
import { db } from "./db";
import { validateManifest, defaultManifest } from "./manifest";
import { nextVersionFor, compareSemver } from "./semver";
import { logAudit } from "./audit";
import { dispatchWebhooks } from "./webhooks";
import { runEvaluation } from "./evals";
import { diffLines } from "./diff";

export type FileInput = { path: string; content: string };

export const STANDARD_DIRS = ["instructions/", "assets/", "tools/", "tests/", "targets/", "releases/"];

export function starterFiles(opts: { name: string; description: string; owner: string; models: string[] }): FileInput[] {
  const files: FileInput[] = [
    { path: "skill.yaml", content: defaultManifest(opts) },
    {
      path: "instructions/main.md",
      content: `# ${opts.name}\n\n${opts.description}\n\n## Behavior\n\n1. Read the input carefully and identify the task type.\n2. Follow the documented procedure step by step.\n3. Produce output in the format declared in \`skill.yaml\`.\n\n## Guardrails\n\n- Never invent data that was not provided in the input.\n- If the input is ambiguous, ask a clarifying question before acting.\n`,
    },
    {
      path: "assets/README.md",
      content: "# Reference assets\n\nPlace templates, schemas, and reference documents here.\n",
    },
    { path: "tools/README.md", content: "# Tools\n\nDeclare every tool this skill needs in `skill.yaml` under `tools:`.\n" },
    {
      path: "tests/regression.yaml",
      content: `# Regression suite for ${opts.name}\ncases:\n  - name: baseline-behavior\n    type: regression\n    required: true\n`,
    },
  ];
  for (const model of opts.models) {
    files.push({
      path: `targets/${model}/overlay.md`,
      content: `# ${model} overlay\n\nProvider-specific adjustments for ${model}. Shared instructions are inherited; only add what differs on ${model} (tool syntax, output formatting, context limits).\n`,
    });
  }
  return files;
}

export async function createSkill(opts: {
  orgId: string;
  actorId: string;
  name: string;
  description: string;
  models: string[];
  visibility: string;
  tags: string[];
  ownerTeam: string;
  files?: FileInput[];
}) {
  const baseSlug = opts.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "skill";
  let slug = baseSlug;
  let n = 1;
  while (await db.skill.findUnique({ where: { orgId_slug: { orgId: opts.orgId, slug } } })) {
    slug = `${baseSlug}-${n++}`;
  }
  const skill = await db.skill.create({
    data: {
      orgId: opts.orgId,
      slug,
      name: opts.name,
      description: opts.description,
      ownerUserId: opts.actorId,
      visibility: opts.visibility as never,
      tags: opts.tags,
      status: "DRAFT",
    },
  });
  const files = opts.files && opts.files.length ? opts.files : starterFiles({ name: slug, description: opts.description, owner: opts.ownerTeam, models: opts.models });
  const manifestFile = files.find((f) => f.path === "skill.yaml");
  const manifestCheck = manifestFile ? validateManifest(manifestFile.content) : { ok: false, errors: ["skill.yaml missing"] };
  const version = await db.skillVersion.create({
    data: {
      skillId: skill.id,
      version: "0.1.0",
      branch: "main",
      status: "DRAFT",
      changeSummary: "Initial version",
      createdById: opts.actorId,
      files: { create: files.map((f) => ({ path: f.path, content: f.content })) },
    },
  });
  await logAudit({
    orgId: opts.orgId,
    actorId: opts.actorId,
    action: "skill.created",
    targetType: "skill",
    targetId: skill.id,
    metadata: { slug, manifestValid: manifestCheck.ok },
  });
  return { skill, version, manifestCheck };
}

export async function saveDraftVersion(opts: {
  skillId: string;
  actorId: string;
  files: FileInput[];
  changeSummary: string;
  riskNotes?: string;
  bump: "major" | "minor" | "patch";
  branch?: string;
  basedOnId?: string;
}) {
  const skill = await db.skill.findUniqueOrThrow({ where: { id: opts.skillId }, include: { versions: true } });
  const branch = opts.branch ?? "main";
  const existingOnBranch = await db.skillVersion.findMany({ where: { skillId: skill.id, branch } });
  const maxVersion = existingOnBranch.map((v) => v.version).sort(compareSemver).pop();
  const nextVersion = nextVersionFor(maxVersion, opts.bump);
  const manifestFile = opts.files.find((f) => f.path === "skill.yaml");
  const manifestCheck = manifestFile ? validateManifest(manifestFile.content) : { ok: false, errors: ["skill.yaml missing"] };

  const version = await db.skillVersion.create({
    data: {
      skillId: skill.id,
      version: nextVersion,
      branch,
      status: "DRAFT",
      changeSummary: opts.changeSummary,
      riskNotes: opts.riskNotes ?? null,
      createdById: opts.actorId,
      basedOnId: opts.basedOnId ?? null,
      files: { create: opts.files.map((f) => ({ path: f.path, content: f.content })) },
    },
  });
  await logAudit({
    orgId: skill.orgId,
    actorId: opts.actorId,
    action: "version.created",
    targetType: "version",
    targetId: version.id,
    metadata: { skill: skill.slug, version: nextVersion, manifestValid: manifestCheck.ok },
  });
  return { version, manifestCheck };
}

export async function changedFilesBetween(fromFiles: FileInput[], toFiles: FileInput[]): Promise<string[]> {
  const fromMap = new Map(fromFiles.map((f) => [f.path, f.content]));
  const toMap = new Map(toFiles.map((f) => [f.path, f.content]));
  const changed: string[] = [];
  for (const [path, content] of toMap) {
    if (!fromMap.has(path) || fromMap.get(path) !== content) changed.push(path);
  }
  for (const path of fromMap.keys()) {
    if (!toMap.has(path)) changed.push(path);
  }
  return changed.sort();
}

export async function submitForReview(opts: { versionId: string; actorId: string }) {
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: opts.versionId }, include: { skill: true } });
  if (version.status !== "DRAFT") throw new Error("Only draft versions can be submitted for review");
  const updated = await db.skillVersion.update({ where: { id: opts.versionId }, data: { status: "IN_REVIEW" } });
  await db.skill.update({ where: { id: version.skillId }, data: { status: "IN_REVIEW" } });
  await logAudit({
    orgId: version.skill.orgId,
    actorId: opts.actorId,
    action: "version.submitted",
    targetType: "version",
    targetId: version.id,
    metadata: { skill: version.skill.slug, version: version.version },
  });
  await dispatchWebhooks(version.skill.orgId, "version.submitted", { skill: version.skill.slug, version: version.version });
  return updated;
}

export async function decideApproval(opts: {
  versionId: string;
  reviewerId: string;
  decision: "APPROVE" | "REJECT" | "OVERRIDE";
  comment: string;
}) {
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: opts.versionId }, include: { skill: true } });
  const approval = await db.approval.create({
    data: { versionId: opts.versionId, reviewerId: opts.reviewerId, decision: opts.decision, comment: opts.comment },
  });
  if (opts.decision === "APPROVE") {
    await db.skillVersion.update({ where: { id: opts.versionId }, data: { status: "APPROVED" } });
    await db.skill.update({ where: { id: version.skillId }, data: { status: "APPROVED" } });
  } else if (opts.decision === "REJECT") {
    await db.skillVersion.update({ where: { id: opts.versionId }, data: { status: "REJECTED" } });
    await db.skill.update({ where: { id: version.skillId }, data: { status: "DRAFT" } });
  }
  await logAudit({
    orgId: version.skill.orgId,
    actorId: opts.reviewerId,
    action: `approval.${opts.decision.toLowerCase()}`,
    targetType: "version",
    targetId: version.id,
    metadata: { skill: version.skill.slug, version: version.version, comment: opts.comment },
  });
  if (opts.decision === "APPROVE") {
    await dispatchWebhooks(version.skill.orgId, "approval.granted", { skill: version.skill.slug, version: version.version });
  }
  return approval;
}

export async function publishVersion(opts: {
  versionId: string;
  actorId: string;
  overrideReason?: string;
}) {
  const version = await db.skillVersion.findUniqueOrThrow({
    where: { id: opts.versionId },
    include: { skill: true, files: true },
  });
  const isAdmin = !!opts.overrideReason;
  if (version.status !== "APPROVED" && !isAdmin) {
    throw new Error("Version must be approved before publishing");
  }
  const latestRun = await db.evalRun.findFirst({
    where: { versionId: opts.versionId },
    orderBy: { createdAt: "desc" },
  });
  const evalPassed = latestRun?.overallPass === true;
  if (!evalPassed && !isAdmin) {
    throw new Error("Required evaluations have not passed. Ask an Admin to override with a documented reason.");
  }
  const previousPublished = await db.skillVersion.findFirst({
    where: { skillId: version.skillId, status: "PUBLISHED", id: { not: version.id } },
    orderBy: { publishedAt: "desc" },
    include: { files: true },
  });
  const changedFiles = previousPublished
    ? await changedFilesBetween(
        previousPublished.files.map((f) => ({ path: f.path, content: f.content })),
        version.files.map((f) => ({ path: f.path, content: f.content }))
      )
    : version.files.map((f) => f.path);

  const release = await db.release.create({
    data: {
      skillId: version.skillId,
      versionId: version.id,
      version: version.version,
      changedFiles,
      evalRunId: latestRun?.id ?? null,
      approvedById: (await db.approval.findFirst({ where: { versionId: version.id, decision: "APPROVE" } }))?.reviewerId ?? null,
      publishedById: opts.actorId,
      notes: isAdmin ? `Admin override: ${opts.overrideReason}` : null,
    },
  });
  await db.skillVersion.update({ where: { id: version.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await db.skill.update({
    where: { id: version.skillId },
    data: { currentVersion: version.version, currentVersionId: version.id, status: "APPROVED" },
  });
  await logAudit({
    orgId: version.skill.orgId,
    actorId: opts.actorId,
    action: isAdmin ? "skill.published.override" : "skill.published",
    targetType: "release",
    targetId: release.id,
    metadata: { skill: version.skill.slug, version: version.version, changedFiles, overrideReason: opts.overrideReason },
  });
  await dispatchWebhooks(version.skill.orgId, isAdmin ? "skill.published" : "skill.published", {
    skill: version.skill.slug,
    version: version.version,
    override: isAdmin,
  });
  if (!evalPassed) {
    await dispatchWebhooks(version.skill.orgId, "evaluation.failed", {
      skill: version.skill.slug,
      version: version.version,
      overridden: true,
    });
  }
  return release;
}

export async function forkSkill(opts: { skillId: string; targetOrgId: string; actorId: string }) {
  const source = await db.skill.findUniqueOrThrow({
    where: { id: opts.skillId },
    include: { versions: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 1, include: { files: true } } },
  });
  const latest = source.versions[0];
  if (!latest) throw new Error("Source skill has no published version to fork");
  const { skill, version } = await createSkill({
    orgId: opts.targetOrgId,
    actorId: opts.actorId,
    name: `${source.name} (fork)`,
    description: source.description,
    models: ["claude", "openai"],
    visibility: "team",
    tags: source.tags,
    ownerTeam: "forked",
    files: latest.files.map((f) => ({ path: f.path, content: f.content })),
  });
  await db.skill.update({ where: { id: skill.id }, data: { forkedFrom: `${source.slug}@${latest.version}` } });
  return { skill, version };
}

export async function restoreVersion(opts: { versionId: string; actorId: string }) {
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: opts.versionId }, include: { files: true, skill: true } });
  const result = await saveDraftVersion({
    skillId: version.skillId,
    actorId: opts.actorId,
    files: version.files.map((f) => ({ path: f.path, content: f.content })),
    changeSummary: `Restore of ${version.version}`,
    riskNotes: "Restored prior version content",
    bump: "patch",
    basedOnId: version.id,
  });
  await logAudit({
    orgId: version.skill.orgId,
    actorId: opts.actorId,
    action: "version.restored",
    targetType: "version",
    targetId: version.id,
    metadata: { restoredFrom: version.version, newVersion: result.version.version },
  });
  return result;
}

export async function runEvalForVersion(opts: { skillId: string; versionId: string; userId: string; model?: string }) {
  const result = await runEvaluation(opts);
  const version = await db.skillVersion.findUniqueOrThrow({ where: { id: opts.versionId }, include: { skill: true } });
  await logAudit({
    orgId: version.skill.orgId,
    actorId: opts.userId,
    action: result.overallPass ? "evaluation.passed" : "evaluation.failed",
    targetType: "eval_run",
    targetId: result.runId,
    metadata: { skill: version.skill.slug, version: version.version },
  });
  if (!result.overallPass) {
    await dispatchWebhooks(version.skill.orgId, "evaluation.failed", {
      skill: version.skill.slug,
      version: version.version,
      runId: result.runId,
    });
  }
  return result;
}
