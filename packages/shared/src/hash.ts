import { createHash, createHmac } from "node:crypto";
import { canonicalJSON, utf8 } from "./canonical.js";

export function sha256Hex(data: string | Uint8Array): string {
  const buf = typeof data === "string" ? utf8(data) : data;
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256Canonical(value: unknown): string {
  return sha256Hex(canonicalJSON(value));
}

export function hmacSha256Hex(secret: string, data: string | Uint8Array): string {
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  return createHmac("sha256", secret).update(buf).digest("hex");
}

/** Constant-time hex compare for webhook signatures. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
