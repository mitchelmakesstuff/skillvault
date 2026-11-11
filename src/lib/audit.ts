import "server-only";
import { db } from "./db";

export async function logAudit(opts: {
  orgId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      orgId: opts.orgId,
      actorId: opts.actorId ?? null,
      actorEmail: opts.actorEmail ?? null,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId ?? null,
      metadata: (opts.metadata ?? {}) as object,
    },
  });
}
