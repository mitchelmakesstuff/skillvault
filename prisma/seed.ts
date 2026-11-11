import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (daysAgo: number, hour = 10) => new Date(now - daysAgo * DAY + hour * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);

function encSecret(value: string) {
  const key = crypto.createHash("sha256").update(process.env.APP_SECRET || "insecure-dev-secret").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return JSON.stringify({ ciphertext: ct.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") });
}

function manifest(p: {
  name: string;
  description: string;
  owner: string;
  version: string;
  models: string[];
  visibility?: string;
  license?: string;
  inputs?: string;
  outputs?: string;
  tools?: string[];
}) {
  return `name: ${p.name}
description: ${p.description}
owner: ${p.owner}
visibility: ${p.visibility ?? "team"}
version: ${p.version}
models:
${p.models.map((m) => `  - ${m}`).join("\n")}
inputs:
${p.inputs ?? `  - name: input_text\n    type: string\n    required: true`}
outputs:
${p.outputs ?? `  - name: result\n    type: string`}
tools:
${(p.tools ?? []).map((t) => `  - ${t}`).join("\n") || "  []"}
${p.license ? `license: ${p.license}\n` : ""}tests:
  - path: tests/regression.yaml
    required: true
`;
}

function instructions(title: string, body: string) {
  return `# ${title}\n\n${body}\n\n## Guardrails\n\n- Never invent data that was not present in the input.\n- If the request is ambiguous, ask one clarifying question before acting.\n- Keep output in the exact format declared in \`skill.yaml\`.\n`;
}

function overlay(model: string, notes: string) {
  return `# ${model} overlay\n\n${notes}\n`;
}

type SeedFile = { path: string; content: string };

async function mkVersion(opts: {
  skillId: string;
  version: string;
  branch?: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";
  summary: string;
  risk?: string;
  files: SeedFile[];
  createdById: string;
  basedOnId?: string;
  createdAt?: Date;
  publishedAt?: Date;
}) {
  return db.skillVersion.create({
    data: {
      skillId: opts.skillId,
      version: opts.version,
      branch: opts.branch ?? "main",
      status: opts.status,
      changeSummary: opts.summary,
      riskNotes: opts.risk,
      createdById: opts.createdById,
      basedOnId: opts.basedOnId,
      createdAt: opts.createdAt,
      publishedAt: opts.publishedAt,
      files: { create: opts.files.map((f) => ({ path: f.path, content: f.content })) },
    },
  });
}

async function mkEval(opts: {
  skillId: string;
  versionId: string;
  userId: string;
  model: string;
  pass: boolean;
  createdAt?: Date;
  results: { name: string; type: "STATIC" | "MODEL" | "REGRESSION"; status: "PASS" | "FAIL"; score?: number; detail: string; latencyMs?: number }[];
}) {
  const run = await db.evalRun.create({
    data: {
      skillId: opts.skillId,
      versionId: opts.versionId,
      status: opts.pass ? "PASSED" : "FAILED",
      overallPass: opts.pass,
      model: opts.model,
      modelVersion: "claude-3-5-sonnet-20241022",
      latencyMs: opts.results.reduce((a, r) => a + (r.latencyMs ?? 400), 0),
      tokensIn: 900 + opts.results.length * 120,
      tokensOut: 260 + opts.results.length * 40,
      costMicros: 4200,
      triggeredById: opts.userId,
      createdAt: opts.createdAt,
      results: { create: opts.results.map((r) => ({ ...r, testCaseId: null })) },
    },
  });
  return run;
}

async function main() {
  console.log("Seeding SkillVault…");
  await db.auditLog.deleteMany();
  await db.evalResult.deleteMany();
  await db.evalRun.deleteMany();
  await db.approval.deleteMany();
  await db.release.deleteMany();
  await db.skillFile.deleteMany();
  await db.skillVersion.deleteMany();
  await db.testCase.deleteMany();
  await db.skill.deleteMany();
  await db.apiKey.deleteMany();
  await db.webhook.deleteMany();
  await db.secret.deleteMany();
  await db.membership.deleteMany();
  await db.organization.deleteMany();
  await db.user.deleteMany();

  const pass = await bcrypt.hash("demo1234", 10);
  const mkUser = (name: string, email: string) => db.user.create({ data: { name, email, passwordHash: pass } });

  const dana = await mkUser("Dana Whitfield", "demo@skillvault.dev");
  const marcus = await mkUser("Marcus Lee", "editor@skillvault.dev");
  const priya = await mkUser("Priya Raman", "reviewer@skillvault.dev");
  const sofia = await mkUser("Sofia Ortiz", "admin@skillvault.dev");
  const tom = await mkUser("Tom Becker", "viewer@skillvault.dev");
  const alex = await mkUser("Alex Chen", "eng@acme.dev");
  const rina = await mkUser("Rina Patel", "public@skillvault.dev");

  const northwind = await db.organization.create({ data: { name: "Northwind Support", slug: "northwind", createdById: dana.id, createdAt: at(120) } });
  const acme = await db.organization.create({ data: { name: "Acme Platform", slug: "acme-platform", createdById: alex.id, createdAt: at(90) } });
  const collective = await db.organization.create({ data: { name: "Open Collective Labs", slug: "open-collective", createdById: rina.id, createdAt: at(60) } });

  await db.membership.createMany({
    data: [
      { orgId: northwind.id, userId: dana.id, role: "OWNER" },
      { orgId: northwind.id, userId: sofia.id, role: "ADMIN" },
      { orgId: northwind.id, userId: marcus.id, role: "EDITOR" },
      { orgId: northwind.id, userId: priya.id, role: "REVIEWER" },
      { orgId: northwind.id, userId: tom.id, role: "VIEWER" },
      { orgId: acme.id, userId: alex.id, role: "OWNER" },
      { orgId: acme.id, userId: dana.id, role: "EDITOR" },
      { orgId: collective.id, userId: rina.id, role: "OWNER" },
    ],
  });

  await db.webhook.create({
    data: {
      orgId: northwind.id,
      url: "https://hooks.northwind.example/skillvault",
      events: ["skill.published", "evaluation.failed"],
      secretEnc: encSecret("whsec_demo_northwind_9f2c4a"),
      createdAt: at(30),
    },
  });
  const keyToken = "svk_demo1234." + crypto.randomBytes(18).toString("hex");
  await db.apiKey.create({
    data: {
      orgId: northwind.id,
      name: "CI pipeline key",
      prefix: keyToken.split(".")[0],
      hash: crypto.createHash("sha256").update(keyToken).digest("hex"),
      createdById: dana.id,
      createdAt: at(25),
      lastUsedAt: at(2),
    },
  });
  await db.secret.create({
    data: { orgId: northwind.id, name: "ZENDESK_API_TOKEN", createdById: dana.id, ...JSON.parse(encSecret("demo-zd-token-1234567890abcdef")), createdAt: at(25) },
  });

  async function mkSkill(opts: {
    orgId: string;
    slug: string;
    name: string;
    description: string;
    ownerId: string;
    visibility: "PRIVATE" | "TEAM" | "ORGANIZATION" | "PUBLIC";
    status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "DEPRECATED" | "ARCHIVED";
    tags: string[];
    license?: string;
    createdAt: Date;
  }) {
    const { ownerId, ...rest } = opts;
    return db.skill.create({ data: { ...rest, ownerUserId: ownerId, currentVersion: null } });
  }

  async function addTests(skillId: string, tests: { name: string; type: "STATIC" | "MODEL" | "REGRESSION"; required?: boolean; modelTarget?: string; inputs: object; expected?: object }[]) {
    for (const t of tests) {
      await db.testCase.create({
        data: {
          skillId,
          name: t.name,
          type: t.type,
          required: t.required ?? false,
          modelTarget: t.modelTarget,
          inputs: t.inputs as object,
          expected: (t.expected ?? undefined) as never,
        },
      });
    }
  }

  async function audit(orgId: string, actorId: string, action: string, targetType: string, targetId: string, createdAt: Date, metadata?: object) {
    await db.auditLog.create({ data: { orgId, actorId, action, targetType, targetId, metadata: (metadata ?? {}) as object, createdAt } });
  }

  // ---------------------------------------------------------------------
  // Skill 1: customer-support-triage (rich history, in-review change)
  // ---------------------------------------------------------------------
  {
    const skill = await mkSkill({
      orgId: northwind.id,
      slug: "customer-support-triage",
      name: "Customer Support Triage",
      description: "Classifies inbound support tickets and recommends a resolution path with priority and routing.",
      ownerId: dana.id,
      visibility: "TEAM",
      status: "IN_REVIEW",
      tags: ["support", "triage", "classification"],
      createdAt: at(40),
    });

    await addTests(skill.id, [
      {
        name: "Manifest and required files",
        type: "STATIC",
        required: true,
        inputs: { validateManifest: true, requireFiles: ["skill.yaml", "instructions/main.md", "tests/regression.yaml"], forbidden: [{ pattern: "api[_-]?key\\s*=" }] },
      },
      {
        name: "Billing ticket reaches billing category",
        type: "MODEL",
        required: true,
        modelTarget: "claude",
        inputs: { variables: { ticket_text: "My card was charged twice for the same subscription this month." } },
        expected: { minScore: 0.75, contains: ["billing", "priority"] },
      },
      {
        name: "No behavioral regressions vs approved release",
        type: "REGRESSION",
        required: true,
        inputs: { baselineVersion: "1.1.0" },
      },
    ]);

    const filesV1: SeedFile[] = [
      {
        path: "skill.yaml",
        content: manifest({
          name: "customer-support-triage",
          description: "Classifies inbound support tickets and recommends a resolution path with priority and routing.",
          owner: "support-ai-team",
          version: "1.0.0",
          models: ["claude", "openai"],
          tools: ["lookup_customer", "search_knowledge_base"],
        }),
      },
      {
        path: "instructions/main.md",
        content: instructions(
          "Customer Support Triage",
          `## Procedure\n\n1. Read the ticket text and identify the customer's intent.\n2. Classify into exactly one category: billing, technical, account, or other.\n3. Assign priority: low, medium, high, or urgent.\n4. Recommend a resolution path referencing the knowledge base where possible.\n\n## Output\n\nReturn JSON with \`category\`, \`priority\`, and \`resolution_path\`.`
        ),
      },
      { path: "assets/response-templates.md", content: "# Response templates\n\nStandard first-response templates per category.\n" },
      { path: "tools/README.md", content: "# Tools\n\n- lookup_customer: fetch customer record by email\n- search_knowledge_base: full-text search over help center\n" },
      { path: "tests/regression.yaml", content: "cases:\n  - name: baseline-behavior\n    type: regression\n    required: true\n" },
      { path: "targets/claude/overlay.md", content: overlay("claude", "Use <ticket> XML delimiters around the ticket body; tool results arrive in function_results blocks.") },
      { path: "targets/openai/overlay.md", content: overlay("openai", "Declare lookup_customer and search_knowledge_base as function tools with strict JSON schema.") },
    ];

    const v100 = await mkVersion({
      skillId: skill.id,
      version: "1.0.0",
      status: "PUBLISHED",
      summary: "Initial production release of the triage skill.",
      files: filesV1,
      createdById: dana.id,
      createdAt: at(38),
      publishedAt: at(36),
    });

    const filesV110: SeedFile[] = filesV1.map((f) =>
      f.path === "skill.yaml"
        ? { path: f.path, content: f.content.replace("version: 1.0.0", "version: 1.1.0") }
        : f.path === "instructions/main.md"
          ? {
              path: f.path,
              content: instructions(
                "Customer Support Triage",
                `## Procedure\n\n1. Read the ticket text and identify the customer's intent.\n2. Classify into exactly one category: billing, technical, account, or other.\n3. Assign priority: low, medium, high, or urgent. Urgent is reserved for security incidents or full outages.\n4. Recommend a resolution path referencing the knowledge base where possible.\n\n## Escalation\n\nIf priority is urgent, also set \`escalate_to\` to the on-call rotation.\n\n## Output\n\nReturn JSON with \`category\`, \`priority\`, \`resolution_path\`, and optional \`escalate_to\`.`
              ),
            }
          : f
    );

    const v110 = await mkVersion({
      skillId: skill.id,
      version: "1.1.0",
      status: "PUBLISHED",
      summary: "Add urgent escalation path and on-call routing.",
      risk: "Changes priority thresholds; may increase escalation volume by ~10%.",
      files: filesV110,
      createdById: marcus.id,
      basedOnId: v100.id,
      createdAt: at(20),
      publishedAt: at(18),
    });

    const eval110 = await mkEval({
      skillId: skill.id,
      versionId: v110.id,
      userId: marcus.id,
      model: "claude",
      pass: true,
      createdAt: at(19),
      results: [
        { name: "Manifest and required files", type: "STATIC", status: "PASS", score: 1, detail: "All static checks passed", latencyMs: 4 },
        { name: "Billing ticket reaches billing category", type: "MODEL", status: "PASS", score: 0.91, detail: "Simulated model run scored 0.91 (threshold 0.75).", latencyMs: 1420 },
        { name: "No behavioral regressions vs approved release", type: "REGRESSION", status: "PASS", score: 0.88, detail: "Drift 6.0% vs 1.0.0; changes confined to instructions/main.md", latencyMs: 14 },
      ],
    });

    await db.release.create({
      data: {
        skillId: skill.id,
        versionId: v110.id,
        version: "1.1.0",
        changedFiles: ["instructions/main.md", "skill.yaml"],
        evalRunId: eval110.id,
        approvedById: priya.id,
        publishedById: dana.id,
        createdAt: at(18),
      },
    });
    await db.approval.create({
      data: { versionId: v110.id, reviewerId: priya.id, decision: "APPROVE", comment: "Escalation rules look right. Eval evidence solid.", createdAt: at(18, 9) },
    });
    await db.skill.update({ where: { id: skill.id }, data: { currentVersion: "1.1.0", currentVersionId: v110.id, status: "IN_REVIEW" } });

    const filesV120: SeedFile[] = filesV110.map((f) =>
      f.path === "skill.yaml"
        ? { path: f.path, content: f.content.replace("version: 1.1.0", "version: 1.2.0") }
        : f.path === "instructions/main.md"
          ? {
              path: f.path,
              content: instructions(
                "Customer Support Triage",
                `## Procedure\n\n1. Read the ticket text and identify the customer's intent.\n2. Classify into exactly one category: billing, technical, account, or other.\n3. Assign priority: low, medium, high, or urgent. Urgent is reserved for security incidents or full outages.\n4. Recommend a resolution path referencing the knowledge base where possible.\n\n## Escalation\n\nIf priority is urgent, also set \`escalate_to\` to the on-call rotation.\n\n## VIP handling\n\nTickets from enterprise accounts start at medium priority minimum.\n\n## Output\n\nReturn JSON with \`category\`, \`priority\`, \`resolution_path\`, and optional \`escalate_to\`.`
              ),
            }
          : f
    );

    const v120 = await mkVersion({
      skillId: skill.id,
      version: "1.2.0",
      status: "IN_REVIEW",
      summary: "Add VIP enterprise handling to triage rules.",
      risk: "Enterprise tickets may bypass low-priority queue; support leads should watch queue depth for a week.",
      files: filesV120,
      createdById: marcus.id,
      basedOnId: v110.id,
      createdAt: at(3),
    });

    await mkEval({
      skillId: skill.id,
      versionId: v120.id,
      userId: marcus.id,
      model: "claude",
      pass: false,
      createdAt: at(3, 12),
      results: [
        { name: "Manifest and required files", type: "STATIC", status: "PASS", score: 1, detail: "All static checks passed", latencyMs: 4 },
        { name: "Billing ticket reaches billing category", type: "MODEL", status: "PASS", score: 0.87, detail: "Simulated model run scored 0.87 (threshold 0.75).", latencyMs: 1310 },
        { name: "No behavioral regressions vs approved release", type: "REGRESSION", status: "FAIL", score: 0.62, detail: "High drift vs 1.1.0 (18.4%) in instructions/main.md. Review VIP threshold before release.", latencyMs: 16 },
      ],
    });

    await audit(northwind.id, dana.id, "skill.created", "skill", skill.id, at(40));
    await audit(northwind.id, dana.id, "skill.published", "release", v100.id, at(36), { version: "1.0.0" });
    await audit(northwind.id, marcus.id, "version.submitted", "version", v110.id, at(19), { version: "1.1.0" });
    await audit(northwind.id, priya.id, "approval.approve", "version", v110.id, at(18, 9), { version: "1.1.0" });
    await audit(northwind.id, dana.id, "skill.published", "release", v110.id, at(18), { version: "1.1.0" });
    await audit(northwind.id, marcus.id, "evaluation.failed", "eval_run", v120.id, at(3, 12), { version: "1.2.0" });
  }

  // ---------------------------------------------------------------------
  // Skill 2: refund-policy-advisor (approved, awaiting publish)
  // ---------------------------------------------------------------------
  {
    const skill = await mkSkill({
      orgId: northwind.id,
      slug: "refund-policy-advisor",
      name: "Refund Policy Advisor",
      description: "Answers refund eligibility questions using the published policy and returns a cited decision draft.",
      ownerId: dana.id,
      visibility: "ORGANIZATION",
      status: "APPROVED",
      tags: ["support", "billing", "policy"],
      createdAt: at(30),
    });
    await addTests(skill.id, [
      { name: "Manifest and required files", type: "STATIC", required: true, inputs: { validateManifest: true, requireFiles: ["skill.yaml", "instructions/main.md"] } },
      { name: "Out-of-policy request cites policy section", type: "MODEL", required: true, modelTarget: "openai", inputs: { variables: { question: "I want a refund for a laptop I bought 400 days ago." } }, expected: { minScore: 0.7, contains: ["policy"] } },
    ]);
    const files: SeedFile[] = [
      {
        path: "skill.yaml",
        content: manifest({
          name: "refund-policy-advisor",
          description: "Answers refund eligibility questions using the published policy and returns a cited decision draft.",
          owner: "support-ai-team",
          version: "0.3.0",
          models: ["openai", "claude"],
          visibility: "organization",
          tools: ["search_policy_docs"],
        }),
      },
      {
        path: "instructions/main.md",
        content: instructions(
          "Refund Policy Advisor",
          `## Policy source\n\nOnly use the refund policy returned by \`search_policy_docs\`. Never quote from memory.\n\n## Decision draft\n\nProduce: eligibility (yes/no/partial), the policy section cited, and a customer-ready paragraph.`
        ),
      },
      { path: "assets/refund-policy-v12.md", content: "# Refund policy v1.2\n\n- Hardware: 30 days\n- Subscriptions: prorated within 60 days\n- Defective items: 90 days with RMA\n" },
      { path: "tools/README.md", content: "# Tools\n\n- search_policy_docs: vector search over policy documents\n" },
      { path: "tests/regression.yaml", content: "cases:\n  - name: baseline-behavior\n    type: regression\n    required: true\n" },
      { path: "targets/openai/overlay.md", content: overlay("openai", "Use response_format json_object for the decision draft; citations as an array of section ids.") },
    ];
    const v020 = await mkVersion({
      skillId: skill.id,
      version: "0.2.0",
      status: "PUBLISHED",
      summary: "First org-wide draft.",
      files,
      createdById: dana.id,
      createdAt: at(28),
      publishedAt: at(27),
    });
    const v030files = files.map((f) => (f.path === "skill.yaml" ? { path: f.path, content: f.content.replace("version: 0.2.0", "version: 0.3.0") } : f.path === "assets/refund-policy-v12.md" ? { path: f.path, content: f.content.replace("Subscriptions: prorated within 60 days", "Subscriptions: prorated within 90 days") } : f));
    const v030 = await mkVersion({
      skillId: skill.id,
      version: "0.3.0",
      status: "APPROVED",
      summary: "Update subscription refund window to 90 days per new policy.",
      risk: "Policy text change only; no prompt logic touched.",
      files: v030files,
      createdById: dana.id,
      basedOnId: v020.id,
      createdAt: at(6),
    });
    await mkEval({
      skillId: skill.id,
      versionId: v030.id,
      userId: dana.id,
      model: "openai",
      pass: true,
      createdAt: at(6, 11),
      results: [
        { name: "Manifest and required files", type: "STATIC", status: "PASS", score: 1, detail: "All static checks passed", latencyMs: 4 },
        { name: "Out-of-policy request cites policy section", type: "MODEL", status: "PASS", score: 0.83, detail: "Simulated model run scored 0.83 (threshold 0.7).", latencyMs: 1180 },
      ],
    });
    await db.approval.create({ data: { versionId: v030.id, reviewerId: priya.id, decision: "APPROVE", comment: "Matches the legal-approved policy doc.", createdAt: at(5) } });
    await db.skill.update({ where: { id: skill.id }, data: { currentVersion: "0.2.0", currentVersionId: v020.id, status: "APPROVED" } });
    await audit(northwind.id, priya.id, "approval.approve", "version", v030.id, at(5), { version: "0.3.0" });
  }

  // ---------------------------------------------------------------------
  // Skills 3-5 for Northwind (simpler histories)
  // ---------------------------------------------------------------------
  async function simpleSkill(opts: {
    orgId: string;
    slug: string;
    name: string;
    description: string;
    ownerId: string;
    visibility: "PRIVATE" | "TEAM" | "ORGANIZATION" | "PUBLIC";
    status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "DEPRECATED" | "ARCHIVED";
    tags: string[];
    models: string[];
    version: string;
    versionStatus: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "APPROVED";
    summary: string;
    instructionsBody: string;
    createdAt: Date;
    publish?: boolean;
    license?: string;
  }) {
    const skill = await mkSkill({
      orgId: opts.orgId,
      slug: opts.slug,
      name: opts.name,
      description: opts.description,
      ownerId: opts.ownerId,
      visibility: opts.visibility,
      status: opts.status,
      tags: opts.tags,
      license: opts.license,
      createdAt: opts.createdAt,
    });
    const files: SeedFile[] = [
      {
        path: "skill.yaml",
        content: manifest({
          name: opts.slug,
          description: opts.description,
          owner: opts.orgId === acme.id ? "platform-eng" : "support-ai-team",
          version: opts.version,
          models: opts.models,
          visibility: opts.visibility.toLowerCase(),
          license: opts.license,
        }),
      },
      { path: "instructions/main.md", content: instructions(opts.name, opts.instructionsBody) },
      { path: "tests/regression.yaml", content: "cases:\n  - name: baseline-behavior\n    type: regression\n    required: true\n" },
      { path: "targets/claude/overlay.md", content: overlay("claude", "No provider-specific changes yet; shared instructions apply.") },
      ...(opts.models.includes("openai") ? [{ path: "targets/openai/overlay.md", content: overlay("openai", "No provider-specific changes yet; shared instructions apply.") }] : []),
    ];
    const version = await mkVersion({
      skillId: skill.id,
      version: opts.version,
      status: opts.versionStatus,
      summary: opts.summary,
      files,
      createdById: opts.ownerId,
      createdAt: opts.createdAt,
      publishedAt: opts.publish ? opts.createdAt : undefined,
    });
    if (opts.publish) {
      await db.release.create({
        data: { skillId: skill.id, versionId: version.id, version: opts.version, changedFiles: files.map((f) => f.path), publishedById: opts.ownerId, createdAt: opts.createdAt },
      });
      await db.skill.update({ where: { id: skill.id }, data: { currentVersion: opts.version, currentVersionId: version.id } });
    } else {
      await db.skill.update({ where: { id: skill.id }, data: { currentVersionId: null } });
    }
    await addTests(skill.id, [
      { name: "Manifest and required files", type: "STATIC", required: true, inputs: { validateManifest: true, requireFiles: ["skill.yaml", "instructions/main.md"] } },
      { name: "Golden input scores above threshold", type: "MODEL", modelTarget: opts.models[0], inputs: { variables: { input_text: "standard golden-case input" } }, expected: { minScore: 0.7 } },
    ]);
    if (opts.versionStatus === "PUBLISHED" || opts.publish) {
      await mkEval({
        skillId: skill.id,
        versionId: version.id,
        userId: opts.ownerId,
        model: opts.models[0],
        pass: true,
        createdAt: opts.createdAt,
        results: [
          { name: "Manifest and required files", type: "STATIC", status: "PASS", score: 1, detail: "All static checks passed", latencyMs: 4 },
          { name: "Golden input scores above threshold", type: "MODEL", status: "PASS", score: 0.84, detail: "Simulated model run scored 0.84 (threshold 0.7).", latencyMs: 1240 },
        ],
      });
    }
    await audit(opts.orgId, opts.ownerId, "skill.created", "skill", skill.id, opts.createdAt);
    return skill;
  }

  await simpleSkill({
    orgId: northwind.id,
    slug: "escalation-drafter",
    name: "Escalation Drafter",
    description: "Drafts escalation briefs for tier-3 engineers from a ticket thread with severity and impact summary.",
    ownerId: marcus.id,
    visibility: "TEAM",
    status: "APPROVED",
    tags: ["support", "escalation"],
    models: ["claude"],
    version: "1.0.1",
    versionStatus: "PUBLISHED",
    summary: "Patch: clarify severity rubric.",
    instructionsBody: `## Procedure\n\n1. Summarize the incident in two sentences.\n2. Map symptoms to severity P1-P4.\n3. Draft the escalation brief with impact, timeline, and asks.`,
    createdAt: at(22),
    publish: true,
  });

  await simpleSkill({
    orgId: northwind.id,
    slug: "csat-summarizer",
    name: "CSAT Summarizer",
    description: "Summarizes weekly CSAT free-text comments into themes with representative quotes and volume counts.",
    ownerId: dana.id,
    visibility: "ORGANIZATION",
    status: "APPROVED",
    tags: ["support", "analytics"],
    models: ["claude", "gemini"],
    version: "0.9.0",
    versionStatus: "PUBLISHED",
    summary: "Weekly theme rollup, first org-wide release.",
    instructionsBody: `## Procedure\n\n1. Cluster comments by theme.\n2. Count volume per theme.\n3. Pick one representative quote per theme, verbatim.`,
    createdAt: at(15),
    publish: true,
  });

  await simpleSkill({
    orgId: northwind.id,
    slug: "knowledge-base-curator",
    name: "Knowledge Base Curator",
    description: "Suggests help-center article updates from recent ticket clusters, with draft rewrites.",
    ownerId: marcus.id,
    visibility: "TEAM",
    status: "DRAFT",
    tags: ["support", "content"],
    models: ["claude"],
    version: "0.2.0",
    versionStatus: "DRAFT",
    summary: "Draft: cluster-based article suggestions.",
    instructionsBody: `## Procedure\n\n1. Take a ticket cluster as input.\n2. Identify the doc gap or confusion.\n3. Propose an article rewrite with a diff-style summary.`,
    createdAt: at(4),
  });

  // ---------------------------------------------------------------------
  // Acme skills (4)
  // ---------------------------------------------------------------------
  await simpleSkill({
    orgId: acme.id,
    slug: "code-reviewer",
    name: "Code Review Assistant",
    description: "Reviews diffs for correctness, security issues, and style; returns structured comments keyed by file and line.",
    ownerId: alex.id,
    visibility: "ORGANIZATION",
    status: "APPROVED",
    tags: ["engineering", "review"],
    models: ["claude", "openai"],
    version: "2.1.0",
    versionStatus: "PUBLISHED",
    summary: "Add security checklist and severity levels to review comments.",
    instructionsBody: `## Procedure\n\n1. Read the diff hunk by hunk.\n2. Flag correctness, security, and style issues.\n3. Rate each comment: blocker, warning, or nit.\n4. Never rewrite the diff unless asked.`,
    createdAt: at(50),
    publish: true,
  });

  await simpleSkill({
    orgId: acme.id,
    slug: "sql-analyst",
    name: "SQL Analyst",
    description: "Turns natural-language analytics questions into safe, read-only SQL against the warehouse schema.",
    ownerId: alex.id,
    visibility: "TEAM",
    status: "APPROVED",
    tags: ["engineering", "analytics", "sql"],
    models: ["openai", "gemini"],
    version: "1.3.2",
    versionStatus: "PUBLISHED",
    summary: "Patch: forbid table scans over 90 days without a WHERE clause.",
    instructionsBody: `## Procedure\n\n1. Match the question to warehouse tables and columns.\n2. Write read-only SQL (SELECT only).\n3. Refuse queries without a time bound on large tables.\n4. Explain the query plan in one sentence.`,
    createdAt: at(33),
    publish: true,
  });

  await simpleSkill({
    orgId: acme.id,
    slug: "incident-commander",
    name: "Incident Commander",
    description: "Runs the incident response checklist: severity assignment, status updates, and postmortem scaffolding.",
    ownerId: alex.id,
    visibility: "TEAM",
    status: "IN_REVIEW",
    tags: ["engineering", "oncall"],
    models: ["claude"],
    version: "0.7.0",
    versionStatus: "IN_REVIEW",
    summary: "Add comms templates for customer-facing status page updates.",
    instructionsBody: `## Procedure\n\n1. Classify severity SEV1-SEV4.\n2. Produce an incident timeline skeleton.\n3. Draft status updates for internal and customer audiences.`,
    createdAt: at(9),
  });

  await simpleSkill({
    orgId: acme.id,
    slug: "api-migration-guide",
    name: "API Migration Guide",
    description: "Generates step-by-step migration plans between API versions, including breaking-change callouts.",
    ownerId: alex.id,
    visibility: "ORGANIZATION",
    status: "DEPRECATED",
    tags: ["engineering", "docs"],
    models: ["openai"],
    version: "1.0.0",
    versionStatus: "PUBLISHED",
    summary: "Initial release; superseded by docs pipeline.",
    instructionsBody: `## Procedure\n\n1. Diff the two OpenAPI specs.\n2. List breaking changes with client impact.\n3. Produce a migration checklist ordered by risk.`,
    createdAt: at(70),
    publish: true,
  });

  // ---------------------------------------------------------------------
  // Open Collective public skills (3)
  // ---------------------------------------------------------------------
  await simpleSkill({
    orgId: collective.id,
    slug: "meeting-action-items",
    name: "Meeting Action Items",
    description: "Extracts owners, deadlines, and action items from meeting transcripts in a standard checklist format.",
    ownerId: rina.id,
    visibility: "PUBLIC",
    status: "APPROVED",
    tags: ["productivity", "meetings"],
    models: ["claude", "openai", "gemini"],
    version: "1.2.0",
    versionStatus: "PUBLISHED",
    summary: "Public release with per-provider overlays.",
    instructionsBody: `## Procedure\n\n1. Scan the transcript for commitments.\n2. Extract owner, task, and deadline for each.\n3. Output a checklist grouped by owner; mark ambiguous owners as UNASSIGNED.`,
    createdAt: at(45),
    publish: true,
    license: "MIT",
  });

  await simpleSkill({
    orgId: collective.id,
    slug: "release-notes-writer",
    name: "Release Notes Writer",
    description: "Turns merged PR lists into user-facing release notes grouped by Added, Changed, Fixed, and Removed.",
    ownerId: rina.id,
    visibility: "PUBLIC",
    status: "APPROVED",
    tags: ["engineering", "docs", "release"],
    models: ["claude", "openai"],
    version: "2.0.0",
    versionStatus: "PUBLISHED",
    summary: "Keep-a-changelog categories; tone dial for internal vs external notes.",
    instructionsBody: `## Procedure\n\n1. Group merged PRs by Keep-a-Changelog category.\n2. Rewrite titles user-first; drop internal jargon.\n3. Flag breaking changes at the top.`,
    createdAt: at(38),
    publish: true,
    license: "CC-BY-4.0",
  });

  await simpleSkill({
    orgId: collective.id,
    slug: "ux-copy-reviewer",
    name: "UX Copy Reviewer",
    description: "Reviews interface copy for clarity, tone, and length, and suggests alternatives that fit the design system.",
    ownerId: rina.id,
    visibility: "PUBLIC",
    status: "APPROVED",
    tags: ["design", "writing"],
    models: ["claude", "gemini"],
    version: "0.5.0",
    versionStatus: "PUBLISHED",
    summary: "First public beta of the copy reviewer.",
    instructionsBody: `## Procedure\n\n1. Check each string for clarity, tone, and length.\n2. Suggest at most two alternatives per string.\n3. Never invent product claims.`,
    createdAt: at(12),
    publish: true,
    license: "Apache-2.0",
  });

  console.log("Seed complete:");
  console.log(`  users: 7, orgs: 3, skills: ${await db.skill.count()}, versions: ${await db.skillVersion.count()}, eval runs: ${await db.evalRun.count()}`);
  console.log(`  demo login: demo@skillvault.dev / demo1234 (Owner of Northwind Support)`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
