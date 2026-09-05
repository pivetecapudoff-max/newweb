import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function keyBytes(): Buffer {
  const secret = process.env.COOKIE_ENCRYPT_KEY || process.env.SESSION_SECRET || "";
  if (secret.length < 16) {
    throw new Error("SESSION_SECRET / COOKIE_ENCRYPT_KEY must be at least 16 characters.");
  }
  return scryptSync(secret, "illusions-cookie-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 29) throw new Error("Ciphertext is truncated.");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
