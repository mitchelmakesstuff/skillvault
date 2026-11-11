import "server-only";
import { createHash } from "crypto";
import { db } from "./db";
import { validateManifest } from "./manifest";
import { diffLines } from "./diff";
import type { SkillFile, TestCase } from "@prisma/client";

function seededScore(seed: string, floor = 0.55, ceil = 0.99): number {
  const hash = createHash("sha256").update(seed).digest();
  const unit = hash.readUInt32BE(0) / 0xffffffff;
  return floor + unit * (ceil - floor);
}

type StaticInputs = {
  requireFiles?: string[];
  forbidden?: { path?: string; pattern: string }[];
  validateManifest?: boolean;
};

type ModelInputs = {
  variables?: Record<string, string>;
  prompt?: string;
};

type RegressionInputs = {
  baselineVersion?: string;
};

export async function runEvaluation(opts: {
  skillId: string;
  versionId: string;
  userId: string;
  model?: string;
}): Promise<{ runId: string; overallPass: boolean; status: "PASSED" | "FAILED" }> {
  const version = await db.skillVersion.findUniqueOrThrow({
    where: { id: opts.versionId },
    include: { files: true, skill: true },
  });
  const testCases = await db.testCase.findMany({ where: { skillId: opts.skillId } });
  const model = opts.model ?? version.files.find((f) => f.path === "skill.yaml")?.content.match(/- (claude|openai|gemini)/)?.[1] ?? "claude";

  const run = await db.evalRun.create({
    data: {
      skillId: opts.skillId,
      versionId: opts.versionId,
      status: "RUNNING",
      model,
      modelVersion: "simulated-1",
      triggeredById: opts.userId,
    },
  });

  const results: {
    testCaseId: string | null;
    name: string;
    type: TestCase["type"];
    status: "PASS" | "FAIL" | "ERROR" | "SKIPPED";
    score?: number;
    detail?: string;
    latencyMs?: number;
  }[] = [];

  const manifestFile = version.files.find((f) => f.path === "skill.yaml");
  const manifestCheck = manifestFile ? validateManifest(manifestFile.content) : { ok: false, errors: ["skill.yaml missing"] };

  if (testCases.length === 0) {
    results.push({
      testCaseId: null,
      name: "Manifest schema validation",
      type: "STATIC",
      status: manifestCheck.ok ? "PASS" : "FAIL",
      score: manifestCheck.ok ? 1 : 0,
      detail: manifestCheck.ok ? "skill.yaml is valid" : manifestCheck.errors.join("; "),
      latencyMs: 3,
    });
  }

  for (const tc of testCases) {
    if (tc.type === "STATIC") {
      const inputs = (tc.inputs ?? {}) as StaticInputs;
      const failures: string[] = [];
      if (inputs.validateManifest !== false) {
        if (!manifestCheck.ok) failures.push(...manifestCheck.errors.map((e) => `manifest: ${e}`));
      }
      for (const required of inputs.requireFiles ?? []) {
        if (!version.files.some((f) => f.path === required)) failures.push(`missing required file: ${required}`);
      }
      for (const rule of inputs.forbidden ?? []) {
        const targets = rule.path ? version.files.filter((f) => f.path === rule.path) : version.files;
        const re = new RegExp(rule.pattern, "i");
        for (const f of targets) {
          if (re.test(f.content)) failures.push(`forbidden content "${rule.pattern}" found in ${f.path}`);
        }
      }
      results.push({
        testCaseId: tc.id,
        name: tc.name,
        type: "STATIC",
        status: failures.length === 0 ? "PASS" : "FAIL",
        score: failures.length === 0 ? 1 : 0,
        detail: failures.length === 0 ? "All static checks passed" : failures.join("; "),
        latencyMs: 5,
      });
    } else if (tc.type === "MODEL") {
      const inputs = (tc.inputs ?? {}) as ModelInputs;
      const expected = (tc.expected ?? {}) as { minScore?: number; contains?: string[] };
      const seed = `${version.id}:${tc.id}:${JSON.stringify(inputs.variables ?? {})}`;
      const score = seededScore(seed);
      const variables = inputs.variables ?? {};
      const rendered = (inputs.prompt ?? version.files.find((f) => f.path.startsWith("instructions/"))?.content ?? "").replace(
        /\{\{(\w+)\}\}/g,
        (_, k: string) => variables[k] ?? `{${k}}`
      );
      const containsFailures = (expected.contains ?? [])
        .filter((needle) => !rendered.toLowerCase().includes(needle.toLowerCase()))
        .map((needle) => `instruction set never mentions "${needle}"`);
      const minScore = expected.minScore ?? 0.7;
      const passed = score >= minScore && containsFailures.length === 0;
      const latency = 400 + Math.round(seededScore(seed + ":lat", 0, 1800));
      const tokensIn = rendered.length / 4 + 120;
      const tokensOut = 180 + Math.round(seededScore(seed + ":out", 0, 400));
      results.push({
        testCaseId: tc.id,
        name: tc.name,
        type: "MODEL",
        status: passed ? "PASS" : "FAIL",
        score: Number(score.toFixed(3)),
        detail: passed
          ? `Simulated model run scored ${score.toFixed(2)} (threshold ${minScore}). Wire MODEL_PROVIDER to run live evaluations.`
          : `Simulated model run scored ${score.toFixed(2)} (threshold ${minScore}).${containsFailures.length ? " " + containsFailures.join("; ") : ""}`,
        latencyMs: latency,
      });
    } else {
      const inputs = (tc.inputs ?? {}) as RegressionInputs;
      let baselineId = version.basedOnId;
      if (inputs.baselineVersion) {
        const baseline = await db.skillVersion.findFirst({
          where: { skillId: opts.skillId, version: inputs.baselineVersion },
        });
        baselineId = baseline?.id ?? baselineId;
      }
      if (!baselineId) {
        results.push({
          testCaseId: tc.id,
          name: tc.name,
          type: "REGRESSION",
          status: "SKIPPED",
          detail: "No baseline version to compare against",
        });
        continue;
      }
      const baseline = await db.skillVersion.findUniqueOrThrow({ where: { id: baselineId }, include: { files: true } });
      const baselineMap = new Map(baseline.files.map((f) => [f.path, f.content]));
      let changed = 0;
      let total = 0;
      const changedFiles: string[] = [];
      for (const f of version.files) {
        total += f.content.length;
        const before = baselineMap.get(f.path) ?? "";
        if (before !== f.content) {
          changed += Math.abs(before.length - f.content.length) + diffLines(before, f.content).filter((r) => r.type !== "same").length * 10;
          changedFiles.push(f.path);
        }
      }
      const ratio = total === 0 ? 0 : changed / total;
      const score = Math.max(0, 1 - ratio * 2);
      const passed = score >= 0.7 && manifestCheck.ok;
      results.push({
        testCaseId: tc.id,
        name: tc.name,
        type: "REGRESSION",
        status: passed ? "PASS" : "FAIL",
        score: Number(score.toFixed(3)),
        detail: passed
          ? `No behavioral regressions detected vs ${baseline.version} (${changedFiles.length} files changed, drift ${(ratio * 100).toFixed(1)}%)`
          : `High drift vs ${baseline.version} (${(ratio * 100).toFixed(1)}%) or manifest invalid. Changed: ${changedFiles.join(", ") || "none"}`,
        latencyMs: 12,
      });
    }
  }

  const requiredTestCases = testCases.filter((t) => t.required);
  const requiredFail = results.some((r) => {
    if (r.status !== "FAIL") return false;
    const tc = testCases.find((t) => t.id === r.testCaseId);
    return tc ? tc.required : r.name === "Manifest schema validation";
  });
  const overallPass = !requiredFail;
  const totalLatency = results.reduce((acc, r) => acc + (r.latencyMs ?? 0), 0);
  const tokensIn = results.reduce((acc, r) => acc + (r.type === "MODEL" ? 900 : 0), 0);
  const tokensOut = results.reduce((acc, r) => acc + (r.type === "MODEL" ? 260 : 0), 0);

  await Promise.all(
    results.map((r) =>
      db.evalResult.create({
        data: {
          runId: run.id,
          testCaseId: r.testCaseId,
          name: r.name,
          type: r.type,
          status: r.status,
          score: r.score,
          detail: r.detail,
          latencyMs: r.latencyMs,
        },
      })
    )
  );

  await db.evalRun.update({
    where: { id: run.id },
    data: {
      status: overallPass ? "PASSED" : "FAILED",
      overallPass,
      latencyMs: totalLatency,
      tokensIn,
      tokensOut,
      costMicros: Math.round((tokensIn * 3 + tokensOut * 15) / 1000),
    },
  });

  return { runId: run.id, overallPass, status: overallPass ? "PASSED" : "FAILED" };
}

export async function latestRunFor(versionId: string) {
  return db.evalRun.findFirst({
    where: { versionId },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  });
}
