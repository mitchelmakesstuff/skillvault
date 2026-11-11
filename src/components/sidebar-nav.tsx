"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Role } from "@/lib/rbac";

const ITEMS: { href: string; label: string; permission?: Parameters<typeof can>[1] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skills", label: "Skill library" },
  { href: "/reviews", label: "Reviews" },
  { href: "/gallery", label: "Public gallery" },
  { href: "/settings", label: "Settings", permission: "workspace.manage" },
];

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
      {ITEMS.filter((item) => !item.permission || can(role, item.permission)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-md px-3 py-2 transition-colors ${
              active ? "bg-ink-700 font-medium text-white" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="pt-2">
        <Link
          href="/skills/new"
          className="btn-primary w-full text-xs"
        >
          + New skill
        </Link>
      </div>
    </nav>
  );
}
