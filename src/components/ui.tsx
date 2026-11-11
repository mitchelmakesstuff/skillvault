import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-700/50 text-slate-300",
  IN_REVIEW: "bg-amber-500/15 text-amber-300",
  APPROVED: "bg-emerald-500/15 text-emerald-300",
  PUBLISHED: "bg-emerald-500/15 text-emerald-300",
  DEPRECATED: "bg-orange-500/15 text-orange-300",
  ARCHIVED: "bg-slate-600/40 text-slate-400",
  REJECTED: "bg-red-500/15 text-red-300",
  PASSED: "bg-emerald-500/15 text-emerald-300",
  FAILED: "bg-red-500/15 text-red-300",
  RUNNING: "bg-blue-500/15 text-blue-300",
  PENDING: "bg-slate-700/50 text-slate-300",
  PASS: "bg-emerald-500/15 text-emerald-300",
  FAIL: "bg-red-500/15 text-red-300",
  ERROR: "bg-red-500/15 text-red-300",
  SKIPPED: "bg-slate-700/50 text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? "bg-slate-700/50 text-slate-300"}`}>{status.replace(/_/g, " ").toLowerCase()}</span>;
}

const VISIBILITY_STYLES: Record<string, string> = {
  PRIVATE: "bg-ink-700 text-slate-300",
  TEAM: "bg-sky-500/15 text-sky-300",
  ORGANIZATION: "bg-violet-500/15 text-violet-300",
  PUBLIC: "bg-lime-500/15 text-lime-300",
};

export function VisibilityBadge({ visibility }: { visibility: string }) {
  return <span className={`badge ${VISIBILITY_STYLES[visibility] ?? ""}`}>{visibility.toLowerCase()}</span>;
}

export function ModelBadge({ model, overlay }: { model: string; overlay?: boolean }) {
  return (
    <span className="badge border border-ink-600 bg-ink-800 font-mono text-slate-300" title={overlay ? "Has a provider-specific overlay" : "Uses shared source content"}>
      {model}
      {overlay ? <span className="text-emerald-400">●</span> : null}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-500/15 text-red-300",
    medium: "bg-amber-500/15 text-amber-300",
    low: "bg-slate-600/40 text-slate-300",
  };
  return <span className={`badge ${styles[severity] ?? ""}`}>{severity} risk</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-slate-400">{body}</p>
      {action ? (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
