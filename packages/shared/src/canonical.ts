/**
 * qev-canonical-json/v1
 * Recursive sorted-keys JSON with no whitespace.
 * Used for signature payloads, vault AAD, and integrity digests.
 *
 * Matches JSON.stringify semantics for undefined: object keys with
 * undefined values are omitted (so vault round-trips via JSON.stringify
 * do not break integrity digests).
 */
export function canonicalJSON(value: unknown): string {
  if (value === undefined) {
    // Should not appear in object values after filtering; arrays map undefined -> null-like skip
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return (
      "[" +
      value
        .map((v) => (v === undefined ? "null" : canonicalJSON(v)))
        .join(",") +
      "]"
    );
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k])).join(",") +
    "}"
  );
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function fromUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
