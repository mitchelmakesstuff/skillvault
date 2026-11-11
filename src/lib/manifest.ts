import { z } from "zod";
import { parse } from "yaml";

export const MODEL_TARGETS = ["claude", "openai", "gemini", "mistral", "llama", "any"] as const;
export type ModelTarget = (typeof MODEL_TARGETS)[number];

const inputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "enum", "json", "file"]),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
});

const outputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "enum", "json"]),
  values: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const skillManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must be kebab-case (lowercase letters, numbers, dashes)"),
  description: z.string().min(10, "description must be at least 10 characters"),
  owner: z.string().min(1),
  visibility: z.enum(["private", "team", "organization", "public"]).optional().default("team"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semantic version, e.g. 1.4.0"),
  models: z.array(z.enum(MODEL_TARGETS)).min(1, "declare at least one model target"),
  inputs: z.array(inputSchema).optional().default([]),
  outputs: z.array(outputSchema).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  tests: z
    .array(
      z.object({
        path: z.string(),
        required: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  license: z.string().optional(),
});

export type SkillManifest = z.infer<typeof skillManifestSchema>;

export type ManifestValidation = {
  ok: boolean;
  manifest?: SkillManifest;
  errors: string[];
};

export function validateManifest(text: string): ManifestValidation {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid YAML: ${(e as Error).message}`] };
  }
  if (raw === null || typeof raw !== "object") {
    return { ok: false, errors: ["skill.yaml must be a YAML mapping"] };
  }
  const parsed = skillManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const m = parsed.data;
  const errors: string[] = [];
  for (const out of m.outputs) {
    if (out.type === "enum" && (!out.values || out.values.length === 0)) {
      errors.push(`outputs.${out.name}: enum outputs must declare values`);
    }
  }
  if (m.visibility === "public" && !m.license) {
    errors.push("public skills must declare a license");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: m, errors: [] };
}

export function defaultManifest(opts: { name: string; description: string; owner: string; models: string[]; version?: string }): string {
  return `name: ${opts.name}
description: ${opts.description}
owner: ${opts.owner}
visibility: team
version: ${opts.version ?? "0.1.0"}
models:
${opts.models.map((m) => `  - ${m}`).join("\n")}
inputs:
  - name: input_text
    type: string
    required: true
outputs:
  - name: result
    type: string
tools: []
tests:
  - path: tests/regression.yaml
    required: true
`;
}
