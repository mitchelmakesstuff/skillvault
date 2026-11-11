"use client";

import { useActionState, useState } from "react";
import { createSkillAction, type FormState } from "@/app/actions/skills";
import { SubmitButton } from "@/components/submit-button";

const MODELS = ["claude", "openai", "gemini", "mistral"];

export function NewSkillForm({ ownerTeamDefault }: { ownerTeamDefault: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(createSkillAction, {});
  const [models, setModels] = useState<string[]>(["claude", "openai"]);
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{state.error}</div> : null}
      <div>
        <label className="label" htmlFor="name">Skill name</label>
        <input id="name" name="name" required className="input" placeholder="Support ticket triage" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" required minLength={10} className="input h-20" placeholder="What does this skill do, and for whom?" />
      </div>
      <div>
        <label className="label">Model targets</label>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs ${models.includes(m) ? "border-accent bg-accent/15 text-white" : "border-ink-600 bg-ink-850 text-slate-400"}`}
            >
              {m}
            </button>
          ))}
        </div>
        {models.map((m) => (
          <input key={m} type="hidden" name="models" value={m} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="visibility">Visibility</label>
          <select id="visibility" name="visibility" className="input" defaultValue="team">
            <option value="private">private</option>
            <option value="team">team</option>
            <option value="organization">organization</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ownerTeam">Owning team</label>
          <input id="ownerTeam" name="ownerTeam" className="input" defaultValue={ownerTeamDefault} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tags">Tags (comma separated)</label>
        <input id="tags" name="tags" className="input" placeholder="support, triage" />
      </div>
      <SubmitButton pendingLabel="Creating package…">Create skill package</SubmitButton>
    </form>
  );
}
