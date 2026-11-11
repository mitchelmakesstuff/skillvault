import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm">SV</span>
          SkillVault
        </Link>
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-slate-400">Welcome back. Your skills are where you left them.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          No account?{" "}
          <Link href="/signup" className="text-accent-hover hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-6 rounded-md border border-ink-700 bg-ink-900 p-3 text-center text-xs text-slate-500">
          Demo accounts: <span className="font-mono text-slate-300">demo@skillvault.dev</span> (Owner) ·{" "}
          <span className="font-mono text-slate-300">reviewer@skillvault.dev</span> (Reviewer) — password{" "}
          <span className="font-mono text-slate-300">demo1234</span>
        </p>
      </div>
    </div>
  );
}
