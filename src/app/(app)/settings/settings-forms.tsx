"use client";

import { useActionState } from "react";
import {
  inviteMemberAction,
  createWebhookAction,
  createApiKeyAction,
  createSecretAction,
  type AdminState,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";

function Notice({ state }: { state: AdminState }) {
  if (state.error) return <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{state.error}</div>;
  if (state.success) return <div className="break-all rounded-md border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-300">{state.success}</div>;
  return null;
}

export function TeamForms() {
  const [state, formAction] = useActionState<AdminState, FormData>(inviteMemberAction, {});
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
      <div className="w-56">
        <label className="label">Invite by email</label>
        <input name="email" type="email" required className="input text-xs" placeholder="teammate@company.com" />
      </div>
      <div className="w-36">
        <label className="label">Role</label>
        <select name="role" className="input text-xs" defaultValue="EDITOR">
          <option value="ADMIN">Admin</option>
          <option value="EDITOR">Editor</option>
          <option value="REVIEWER">Reviewer</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>
      <SubmitButton className="btn-secondary text-xs" pendingLabel="Adding…">Add member</SubmitButton>
      <div className="w-full"><Notice state={state} /></div>
    </form>
  );
}

export function WebhookForm() {
  const [state, formAction] = useActionState<AdminState, FormData>(createWebhookAction, {});
  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input name="url" required className="input text-xs" placeholder="https://hooks.internal/notify" />
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        {["skill.published", "approval.granted", "evaluation.failed", "version.submitted"].map((e) => (
          <label key={e} className="flex items-center gap-1.5">
            <input type="checkbox" name="events" value={e} defaultChecked={e === "skill.published"} className="accent-indigo-500" /> {e}
          </label>
        ))}
      </div>
      <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Creating…">Create webhook</SubmitButton>
      <Notice state={state} />
    </form>
  );
}

export function ApiKeyForm() {
  const [state, formAction] = useActionState<AdminState, FormData>(createApiKeyAction, {});
  return (
    <form action={formAction} className="mt-4">
      <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Generating…">Generate API key</SubmitButton>
      <div className="mt-2"><Notice state={state} /></div>
    </form>
  );
}

export function SecretForm() {
  const [state, formAction] = useActionState<AdminState, FormData>(createSecretAction, {});
  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input name="name" required className="input font-mono text-xs" placeholder="OPENAI_API_KEY" />
      <input name="value" type="password" required className="input text-xs" placeholder="secret value" />
      <SubmitButton className="btn-secondary w-full text-xs" pendingLabel="Encrypting…">Store secret</SubmitButton>
      <Notice state={state} />
    </form>
  );
}
