"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSkill } from "@/lib/onboarding-client";

const TEMPLATES = [
  {
    id: "support-triage",
    name: "Support ticket triage",
    description: "Classifies inbound tickets by category and priority, and recommends a resolution path.",
    models: ["claude", "openai"],
  },
  {
    id: "code-reviewer",
    name: "Code review assistant",
    description: "Reviews diffs for correctness, security issues, and style, and leaves structured comments.",
    models: ["claude"],
  },
  {
    id: "blank",
    name: "Start from blank",
    description: "A minimal package with a manifest, instructions, and a regression test.",
    models: ["claude", "openai", "gemini"],
  },
] as const;

export function OnboardingWizard({ userName }: { userName: string }) {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string>("support-triage");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [models, setModels] = useState<string[]>(["claude", "openai"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const chosen = TEMPLATES.find((t) => t.id === template)!;

  function pickTemplate(id: string) {
    setTemplate(id);
    const t = TEMPLATES.find((x) => x.id === id)!;
    if (id !== "blank") {
      setName(t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
      setDescription(t.description);
      setModels([...t.models]);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createSkill({
        name: name || chosen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: description || chosen.description,
        models,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/skills/${res.slug}`);
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        {["Describe the skill", "Choose model targets", "Create package"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 ${step > i ? "bg-accent text-white" : "bg-ink-700 text-slate-400"}`}>{i + 1}</span>
            <span className={step > i ? "text-slate-300" : ""}>{label}</span>
            {i < 2 ? <span className="text-ink-500">→</span> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Hi {userName.split(" ")[0]}. What should your first skill do?</p>
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t.id)}
                className={`w-full rounded-md border p-4 text-left transition-colors ${
                  template === t.id ? "border-accent bg-accent/10" : "border-ink-600 bg-ink-850 hover:border-ink-500"
                }`}
              >
                <div className="text-sm font-medium text-white">{t.name}</div>
                <div className="mt-1 text-xs text-slate-400">{t.description}</div>
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Which model targets should this skill declare? Shared instructions stay canonical; provider-specific overlays
            live under <span className="code">targets/</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            {["claude", "openai", "gemini", "mistral"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs ${
                  models.includes(m) ? "border-accent bg-accent/15 text-white" : "border-ink-600 bg-ink-850 text-slate-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {models.length === 0 ? <p className="text-xs text-red-400">Select at least one target.</p> : null}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn-primary" disabled={models.length === 0} onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="skill-name">
              Skill name (kebab-case)
            </label>
            <input id="skill-name" className="input font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="support-ticket-triage" />
          </div>
          <div>
            <label className="label" htmlFor="skill-desc">
              Description
            </label>
            <textarea id="skill-desc" className="input h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="rounded-md border border-ink-700 bg-ink-850 p-3 text-xs text-slate-400">
            SkillVault will generate: <span className="code">skill.yaml</span>, <span className="code">instructions/main.md</span>,{" "}
            <span className="code">assets/</span>, <span className="code">tools/</span>, <span className="code">tests/regression.yaml</span>, and{" "}
            <span className="code">targets/{models[0] ?? "claude"}/</span> overlays.
          </div>
          {error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</div> : null}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={pending}>
              {pending ? "Creating package…" : "Create skill package"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
