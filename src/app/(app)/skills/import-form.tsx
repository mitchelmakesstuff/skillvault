"use client";

import { useActionState } from "react";
import { importSkillAction, type FormState } from "@/app/actions/skills";
import { SubmitButton } from "@/components/submit-button";

export function ImportForm() {
  const [state, formAction] = useActionState<FormState, FormData>(importSkillAction, {});
  return (
    <form action={formAction} className="mt-3 space-y-2">
      {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{state.error}</div> : null}
      <input type="file" name="file" accept=".zip" required className="input text-xs" />
      <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Importing…">
        Import package
      </SubmitButton>
    </form>
  );
}
