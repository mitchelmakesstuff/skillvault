import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

const FEATURES = [
  {
    title: "Versioned skill packages",
    body: "Every skill is a structured package — manifest, instructions, tools, tests, targets — with immutable semantic versions. No loose prompts, no copy-paste drift.",
  },
  {
    title: "Readable diffs, real reviews",
    body: "Reviewers see human-readable diffs of prompt text, Markdown, YAML and code, plus evaluation results and risk notes before anything ships.",
  },
  {
    title: "Evaluations gate releases",
    body: "Static validation, model-based scoring, and regression runs against the prior approved version. Failing required tests blocks publish — overrides are documented.",
  },
  {
    title: "Model targets made explicit",
    body: "One canonical source of truth with per-provider overlays for Claude, OpenAI, and Gemini. Portability risks are surfaced, not hidden.",
  },
  {
    title: "Deploy anywhere",
    body: "Export to Claude Code skill directories, Custom GPT instructions, or pull any version through the API. Webhooks fire on publish, approval, and failed evals.",
  },
  {
    title: "Built for audit",
    body: "Multi-tenant workspaces, five roles, encrypted secrets, and an audit log of every create, edit, approval, and deployment.",
  },
];

const STEPS = [
  { n: "01", title: "Package", body: "Modeler your skill once: manifest, instructions, tools, tests." },
  { n: "02", title: "Evaluate", body: "Run static, model-based, and regression suites on every change." },
  { n: "03", title: "Review", body: "Team leads approve diffs with eval evidence attached." },
  { n: "04", title: "Release", body: "Publish a semver release and deploy to any supported target." },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm">SV</span>
            SkillVault
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/gallery" className="hidden text-slate-300 hover:text-white sm:block">
              Public gallery
            </Link>
            {user ? (
              <Link href="/dashboard" className="btn-primary">
                Open workspace
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary">
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
          <div className="badge mx-auto border border-ink-600 bg-ink-900 text-slate-300">Skill lifecycle &amp; release platform</div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Ship AI skills the way you ship software.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Create an AI skill once, test it against real cases, version it safely, review changes, deploy it to the right
            models and environments — and know exactly what changed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-5 py-2.5">
              Create your first skill
            </Link>
            <Link href="/login" className="btn-secondary px-5 py-2.5">
              Explore the demo workspace
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">Demo login: demo@skillvault.dev · demo1234</p>
        </section>

        <section className="border-y border-ink-800 bg-ink-900/40">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-6 text-center text-xs uppercase tracking-widest text-slate-500 sm:grid-cols-4">
            <div>Branch &amp; version</div>
            <div>Evaluate before release</div>
            <div>Review with evidence</div>
            <div>Deploy to any model</div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-2xl font-semibold text-white">Not a prompt library. A release platform.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
            Teams treat AI capabilities like production software. SkillVault is their system of record.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-ink-800 bg-ink-900/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-center text-2xl font-semibold text-white">The skill release pipeline</h2>
            <div className="mt-12 grid gap-4 sm:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="card p-6">
                  <div className="font-mono text-sm text-accent-hover">{s.n}</div>
                  <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold text-white">Stop pasting prompts into chat threads.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Give your team one canonical source of truth for every AI capability — with tests, reviews, and releases.
          </p>
          <Link href="/signup" className="btn-primary mt-8 px-6 py-3">
            Start free
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink-800 py-8 text-center text-xs text-slate-600">
        SkillVault — version, evaluate, review, and release AI skills.
      </footer>
    </div>
  );
}
