import { randomBytes } from "node:crypto";

export function newId(prefix = ""): string {
  const hex = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${hex}` : hex;
}
