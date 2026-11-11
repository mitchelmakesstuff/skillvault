import "server-only";
import { db } from "./db";
import { decryptSecret, hmacSignature } from "./crypto";

export type WebhookEvent = "skill.published" | "approval.granted" | "evaluation.failed" | "version.submitted";

export async function dispatchWebhooks(orgId: string, event: WebhookEvent, payload: Record<string, unknown>) {
  const hooks = await db.webhook.findMany({ where: { orgId, active: true, events: { has: event } } });
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data: payload });
  await Promise.all(
    hooks.map(async (hook) => {
      try {
        const secret = decryptSecret(JSON.parse(hook.secretEnc));
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SkillVault-Event": event,
            "X-SkillVault-Signature": hmacSignature(body, secret),
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // delivery failures are non-blocking; a retry queue is a roadmap item
      }
    })
  );
}
