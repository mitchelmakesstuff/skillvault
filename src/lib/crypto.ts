import crypto from "crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET || "insecure-dev-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(enc: { ciphertext: string; iv: string; authTag: string }): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function hmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return "••••••••" + value.slice(-4);
}
