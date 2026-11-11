"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="mt-5 space-y-4">
      {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{state.error}</div> : null}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" defaultValue="demo@skillvault.dev" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required className="input" defaultValue="demo1234" />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
