"use client";

import { useActionState } from "react";
import { signupAction, type AuthState } from "@/app/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signupAction, {});
  return (
    <form action={formAction} className="mt-5 space-y-4">
      {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{state.error}</div> : null}
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className="input" placeholder="Ada Lovelace" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Work email
        </label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="At least 8 characters" />
      </div>
      <div>
        <label className="label" htmlFor="orgName">
          Workspace name
        </label>
        <input id="orgName" name="orgName" className="input" placeholder="Acme AI Platform" />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
