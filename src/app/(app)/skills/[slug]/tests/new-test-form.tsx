"use client";

import { useActionState, useState } from "react";
import { createTestCaseAction, type FormState } from "@/app/actions/skills";
import { SubmitButton } from "@/components/submit-button";

export function NewTestForm({ skillId }: { skillId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(createTestCaseAction, {});
  const [type, setType] = useState<"STATIC" | "MODEL" | "REGRESSION">("STATIC");
  return (
    <form action={formAction} className="mt-3 space-y-3 text-xs">
      {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-red-300">{state.error}</div> : null}
      {state.success ? <div className="rounded-md border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-emerald-300">{state.success}</div> : null}
      <input type="hidden" name="skillId" value={skillId} />
      <div>
        <label className="label">Name</label>
        <input name="name" required className="input text-xs" placeholder="billing tickets stay in category" />
      </div>
      <div>
        <label className="label">Type</label>
        <select name="type" className="input text-xs" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="STATIC">static validation</option>
          <option value="MODEL">model-based evaluation</option>
          <option value="REGRESSION">regression vs prior version</option>
        </select>
      </div>
      {type === "STATIC" ? (
        <>
          <div>
            <label className="label">Required files (one per line)</label>
            <textarea name="requireFiles" className="input h-16 font-mono" placeholder={"skill.yaml\ninstructions/main.md"} />
          </div>
          <div>
            <label className="label">Forbidden patterns (regex, one per line)</label>
            <textarea name="forbidden" className="input h-16 font-mono" placeholder="api[_-]?key\s*=" />
          </div>
        </>
      ) : null}
      {type === "MODEL" ? (
        <>
          <div>
            <label className="label">Input variables (JSON)</label>
            <textarea name="variables" className="input h-16 font-mono" defaultValue='{"ticket_text": "My card was charged twice"}' />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Min score</label>
              <input name="minScore" type="number" step="0.05" min="0" max="1" defaultValue="0.7" className="input text-xs" />
            </div>
            <div>
              <label className="label">Model target</label>
              <input name="modelTarget" className="input font-mono text-xs" placeholder="claude" />
            </div>
          </div>
          <div>
            <label className="label">Output must mention (comma separated)</label>
            <input name="contains" className="input text-xs" placeholder="category, priority" />
          </div>
        </>
      ) : null}
      {type === "REGRESSION" ? (
        <div>
          <label className="label">Baseline version (optional)</label>
          <input name="baselineVersion" className="input font-mono text-xs" placeholder="1.3.0" />
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-slate-300">
        <input type="checkbox" name="required" className="accent-indigo-500" /> Required gate — blocks publishing on failure
      </label>
      <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Creating…">
        Create test case
      </SubmitButton>
    </form>
  );
}
