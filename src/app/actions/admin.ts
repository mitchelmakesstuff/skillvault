"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { can, ROLE_LABELS, type Role } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";

export type AdminState = { error?: string; success?: string; apiKey?: string };

export async function inviteMemberAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return { error: "Only Admins and Owners can manage the team." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "VIEWER") as Role;
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!ROLE_LABELS[role]) return { error: "Invalid role." };
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: { name: email.split("@")[0], email, passwordHash: await hashPassword("welcome123") },
    });
  }
  const existing = await db.membership.findUnique({ where: { orgId_userId: { orgId: ws.orgId, userId: user.id } } });
  if (existing) return { error: "This person is already a member of the workspace." };
  await db.membership.create({ data: { orgId: ws.orgId, userId: user.id, role } });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "member.invited", targetType: "membership", targetId: user.id, metadata: { email, role } });
  revalidatePath("/settings");
  return { success: `${email} added as ${ROLE_LABELS[role]}. Default password: welcome123` };
}

export async function updateMemberRoleAction(formData: FormData) {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return;
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const membership = await db.membership.findUnique({ where: { id: membershipId }, include: { user: true } });
  if (!membership || membership.orgId !== ws.orgId) return;
  if (membership.role === "OWNER" && ws.role !== "OWNER") return;
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "member.role_changed", targetType: "membership", targetId: membershipId, metadata: { email: membership.user.email, role } });
  revalidatePath("/settings");
}

export async function removeMemberAction(formData: FormData) {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return;
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await db.membership.findUnique({ where: { id: membershipId }, include: { user: true } });
  if (!membership || membership.orgId !== ws.orgId) return;
  if (membership.role === "OWNER") return;
  await db.membership.delete({ where: { id: membershipId } });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "member.removed", targetType: "membership", targetId: membershipId, metadata: { email: membership.user.email } });
  revalidatePath("/settings");
}

export async function createWebhookAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return { error: "Only Admins and Owners can manage webhooks." };
  const url = String(formData.get("url") ?? "").trim();
  const events = formData.getAll("events").map(String).filter(Boolean);
  if (!/^https?:\/\//.test(url)) return { error: "Enter a valid http(s) URL." };
  if (events.length === 0) return { error: "Select at least one event." };
  const secret = crypto.randomBytes(24).toString("hex");
  await db.webhook.create({
    data: { orgId: ws.orgId, url, events, secretEnc: JSON.stringify(encryptSecret(secret)) },
  });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "webhook.created", targetType: "webhook", metadata: { url, events } });
  revalidatePath("/settings");
  return { success: `Webhook created. Signing secret (shown once): ${secret}` };
}

export async function deleteWebhookAction(formData: FormData) {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return;
  const id = String(formData.get("webhookId") ?? "");
  const hook = await db.webhook.findUnique({ where: { id } });
  if (!hook || hook.orgId !== ws.orgId) return;
  await db.webhook.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function createApiKeyAction(_prev: AdminState, _formData: FormData): Promise<AdminState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return { error: "Only Admins and Owners can create API keys." };
  const prefix = "svk_" + crypto.randomBytes(4).toString("hex");
  const token = `${prefix}.${crypto.randomBytes(24).toString("hex")}`;
  await db.apiKey.create({
    data: {
      orgId: ws.orgId,
      name: `Key ${new Date().toISOString().slice(0, 10)}`,
      prefix,
      hash: crypto.createHash("sha256").update(token).digest("hex"),
      createdById: ws.user.id,
    },
  });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "api_key.created", targetType: "api_key", metadata: { prefix } });
  revalidatePath("/settings");
  return { success: "API key created. Copy it now, it will not be shown again.", apiKey: token };
}

export async function deleteApiKeyAction(formData: FormData) {
  const ws = await requireWorkspace();
  if (!can(ws.role, "workspace.manage")) return;
  const id = String(formData.get("keyId") ?? "");
  const key = await db.apiKey.findUnique({ where: { id } });
  if (!key || key.orgId !== ws.orgId) return;
  await db.apiKey.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function createSecretAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const ws = await requireWorkspace();
  if (!can(ws.role, "secrets.manage")) return { error: "Only Admins and Owners can manage secrets." };
  const name = String(formData.get("name") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const value = String(formData.get("value") ?? "");
  if (!name || !value) return { error: "Secret name and value are required." };
  const existing = await db.secret.findUnique({ where: { orgId_name: { orgId: ws.orgId, name } } });
  const enc = encryptSecret(value);
  if (existing) {
    await db.secret.update({ where: { id: existing.id }, data: { ...enc } });
  } else {
    await db.secret.create({ data: { orgId: ws.orgId, name, createdById: ws.user.id, ...enc } });
  }
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: existing ? "secret.updated" : "secret.created", targetType: "secret", metadata: { name } });
  revalidatePath("/settings");
  return { success: `Secret ${name} stored encrypted (AES-256-GCM). It is never displayed again.` };
}

export async function deleteSecretAction(formData: FormData) {
  const ws = await requireWorkspace();
  if (!can(ws.role, "secrets.manage")) return;
  const id = String(formData.get("secretId") ?? "");
  const secret = await db.secret.findUnique({ where: { id } });
  if (!secret || secret.orgId !== ws.orgId) return;
  await db.secret.delete({ where: { id } });
  await logAudit({ orgId: ws.orgId, actorId: ws.user.id, action: "secret.deleted", targetType: "secret", metadata: { name: secret.name } });
  revalidatePath("/settings");
}
