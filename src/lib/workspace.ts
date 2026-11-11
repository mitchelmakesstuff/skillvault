import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSessionUser, type SessionUser } from "./auth";
import type { Role } from "./rbac";

export const ORG_COOKIE = "sv_org";

export async function getActiveWorkspace(user: SessionUser) {
  const cookieOrg = (await cookies()).get(ORG_COOKIE)?.value;
  const memberships = user.memberships;
  if (memberships.length === 0) return null;
  const active = memberships.find((m) => m.org.slug === cookieOrg) ?? memberships[0];
  return active;
}

export async function requireWorkspace(): Promise<{
  user: SessionUser;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
  memberships: SessionUser["memberships"];
}> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const active = await getActiveWorkspace(user);
  if (!active) redirect("/onboarding");
  return {
    user,
    orgId: active.orgId,
    orgName: active.org.name,
    orgSlug: active.org.slug,
    role: active.role as Role,
    memberships: user.memberships,
  };
}

export async function requireMembership(orgId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId, userId: user.id } },
  });
  if (!membership) redirect("/dashboard");
  return { user, membership };
}
