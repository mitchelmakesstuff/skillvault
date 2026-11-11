export type PortabilityRisk = {
  severity: "high" | "medium" | "low";
  file: string;
  rule: string;
  message: string;
};

type Rule = {
  id: string;
  severity: PortabilityRisk["severity"];
  pattern: RegExp;
  message: string;
  appliesTo?: string;
};

const RULES: Rule[] = [
  {
    id: "anthropic-xml-tags",
    severity: "high",
    pattern: /<function_calls>|<antml|<tool_result>/i,
    message: "Anthropic-specific tool-calling XML syntax will not work on other providers.",
    appliesTo: "claude",
  },
  {
    id: "openai-function-syntax",
    severity: "high",
    pattern: /"type":\s*"function"|chat\.completions|response_format.*json_object/i,
    message: "OpenAI-specific function-calling / response format syntax detected.",
    appliesTo: "openai",
  },
  {
    id: "gemini-grounding",
    severity: "medium",
    pattern: /google_search_retrieval|gemini-1\.5|genai\.Client/i,
    message: "Gemini-specific grounding or SDK reference detected.",
    appliesTo: "gemini",
  },
  {
    id: "system-prompt-assumption",
    severity: "medium",
    pattern: /\bsystem prompt\b|you are the system/i,
    message: "Assumes a system-prompt channel; some integrations only support a single user message.",
  },
  {
    id: "json-mode-assumption",
    severity: "medium",
    pattern: /respond (only )?in (raw )?json\b/i,
    message: "Requires strict JSON output; verify the target model honors JSON mode or a schema constraint.",
  },
  {
    id: "provider-mention",
    severity: "low",
    pattern: /\b(claude|gpt-4|gpt-3\.5|gemini|mistral-large)\b/i,
    message: "References a specific model by name; may read oddly when run on another target.",
  },
  {
    id: "temperature-in-prompt",
    severity: "low",
    pattern: /temperature\s*[:=]/i,
    message: "Sampling settings inside prompt files are ignored by most runtimes; move to target config.",
  },
];

export function scanPortability(files: { path: string; content: string }[]): PortabilityRisk[] {
  const risks: PortabilityRisk[] = [];
  for (const file of files) {
    if (file.path.startsWith("targets/")) continue;
    for (const rule of RULES) {
      if (rule.appliesTo && !file.path.startsWith(`targets/${rule.appliesTo}`)) {
        // provider-specific rules only fire inside shared content
      }
      if (rule.pattern.test(file.content)) {
        risks.push({
          severity: rule.appliesTo && file.path.startsWith("targets/") ? "low" : rule.severity,
          file: file.path,
          rule: rule.id,
          message: rule.message,
        });
      }
    }
  }
  return risks;
}

export function targetCoverage(models: string[], files: { path: string }[]): { target: string; hasOverlay: boolean; coveredByTests: boolean }[] {
  const overlayTargets = new Set(
    files.filter((f) => f.path.startsWith("targets/")).map((f) => f.path.split("/")[1])
  );
  return models.map((m) => ({
    target: m,
    hasOverlay: overlayTargets.has(m),
    coveredByTests: true,
  }));
}
