import { describe, expect, it } from "vitest";
import { canonicalJSON } from "./canonical.js";
import { sha256Canonical, hmacSha256Hex, timingSafeEqualHex } from "./hash.js";

describe("shared", () => {
  it("canonicalJSON sorts keys", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("sha256Canonical is stable", () => {
    const h1 = sha256Canonical({ z: 1, a: { y: 2, x: 3 } });
    const h2 = sha256Canonical({ a: { x: 3, y: 2 }, z: 1 });
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("hmac and timing-safe compare", () => {
    const sig = hmacSha256Hex("secret", "body");
    expect(timingSafeEqualHex(sig, sig)).toBe(true);
    expect(timingSafeEqualHex(sig, "0".repeat(64))).toBe(false);
  });

  it("omits undefined object keys (JSON round-trip safe)", () => {
    const a = canonicalJSON({ b: 1, a: undefined, c: { d: 2, e: undefined } });
    const b = canonicalJSON(JSON.parse(JSON.stringify({ b: 1, a: undefined, c: { d: 2, e: undefined } })));
    expect(a).toBe(b);
    expect(a).toBe('{"b":1,"c":{"d":2}}');
  });
});
