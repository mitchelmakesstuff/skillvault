import "server-only";
import crypto from "crypto";
import { db } from "./db";

export async function authenticateApiKey(req: Request): Promise<{ orgId: string; keyId: string } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const prefix = token.split(".")[0];
  if (!prefix) return null;
  const candidate = await db.apiKey.findUnique({ where: { prefix } });
  if (!candidate) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  if (hash !== candidate.hash) return null;
  await db.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });
  return { orgId: candidate.orgId, keyId: candidate.id };
}
