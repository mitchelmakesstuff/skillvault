"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ORG_COOKIE } from "@/lib/workspace";

export type AuthState = { error?: string };

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "workspace";
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("orgName") ?? "").trim() || `${name}'s workspace`;
  if (!name || !email || password.length < 8) {
    return { error: "Name, a valid email, and a password of at least 8 characters are required." };
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists. Log in instead." };

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  let slug = slugify(orgName);
  let n = 1;
  while (await db.organization.findUnique({ where: { slug } })) slug = `${slugify(orgName)}-${n++}`;
  const org = await db.organization.create({ data: { name: orgName, slug, createdById: user.id } });
  await db.membership.create({ data: { orgId: org.id, userId: user.id, role: "OWNER" } });
  await logAudit({ orgId: org.id, actorId: user.id, actorEmail: email, action: "workspace.created", targetType: "organization", targetId: org.id });
  await createSession(user.id);
  (await cookies()).set(ORG_COOKIE, org.slug, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/onboarding");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  const membership = await db.membership.findFirst({ where: { userId: user.id }, include: { org: true } });
  if (membership) (await cookies()).set(ORG_COOKIE, membership.org.slug, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function switchOrgAction(formData: FormData) {
  const slug = String(formData.get("orgSlug") ?? "");
  (await cookies()).set(ORG_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/dashboard");
}
