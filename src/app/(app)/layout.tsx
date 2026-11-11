import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { SidebarNav } from "@/components/sidebar-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-ink-800 bg-ink-900">
        <div className="border-b border-ink-800 p-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm">SV</span>
            SkillVault
          </Link>
          <div className="mt-3">
            <WorkspaceSwitcher
              current={{ slug: ws.orgSlug, name: ws.orgName }}
              options={ws.memberships.map((m) => ({ slug: m.org.slug, name: m.org.name }))}
            />
          </div>
        </div>
        <SidebarNav role={ws.role} />
        <div className="mt-auto border-t border-ink-800 p-4 text-xs text-slate-400">
          <div className="font-medium text-slate-200">{ws.user.name}</div>
          <div>{ws.user.email}</div>
          <div className="mt-1 text-slate-500">{ROLE_LABELS[ws.role]} · {ws.orgName}</div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="btn-ghost w-full justify-start px-2 py-1.5 text-xs">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
