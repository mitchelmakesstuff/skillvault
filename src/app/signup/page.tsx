import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm">SV</span>
          SkillVault
        </Link>
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Create your workspace</h1>
          <p className="mt-1 text-sm text-slate-400">Free while in beta. You will be the workspace Owner.</p>
          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-hover hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
