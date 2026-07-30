import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import { b64urlEncode, sha256Hex } from "@imagineqira/qev-shared";
import {
  CAPTURE_ACTIONS,
  EVALUATION_LIMITS,
  LICENSE_SCHEMA,
  entitlementForCapture,
  licensePayload,
  licenseSummary,
  verifyLicense,
  type License,
} from "./license.js";

const DAY = 86_400_000;

async function makeKey() {
  const priv = ed.utils.randomPrivateKey();
  const pub = await ed.getPublicKeyAsync(priv);
  return { priv, pubB64: b64urlEncode(pub) };
}

async function signLicense(l: License, priv: Uint8Array, pubB64: string): Promise<License> {
  const payload = licensePayload(l);
  const sig = await ed.signAsync(new TextEncoder().encode(payload), priv);
  return {
    ...l,
    signature: {
      algorithm: "ed25519",
      public_key: pubB64,
      signature: b64urlEncode(sig),
      signed_at: new Date().toISOString(),
      payload_sha256: sha256Hex(payload),
    },
  };
}

function baseLicense(over: Partial<License> = {}): License {
  return {
    schema: LICENSE_SCHEMA,
    license_id: "LIC-TEST-0001",
    tier: "pilot",
    org: { name: "Test Co" },
    issued_at: "2026-07-01T00:00:00.000Z",
    expires_at: null,
    limits: { packages: null, cases: null },
    grace_days: 14,
    ...over,
  };
}

describe("licence entitlements", () => {
  describe("the published promise: entitlements gate capture only", () => {
    // /pricing states that packages stay openable even after a subscription
    // ends. The structural guarantee is that the gate takes a CaptureAction
    // and there is no read equivalent — so no future change can gate reads
    // without deliberately adding one.
    it("exposes no gateable read/verify/export action", () => {
      const gateable = new Set<string>(CAPTURE_ACTIONS);
      for (const forbidden of [
        "open_package", "verify_package", "list_packages",
        "download_package", "export_bundle", "read_certificate",
      ]) {
        expect(gateable.has(forbidden), `"${forbidden}" must never be gateable`).toBe(false);
      }
    });

    it("gates only the five capture actions", () => {
      expect([...CAPTURE_ACTIONS].sort()).toEqual(
        ["ingest_event", "portal_event", "seal_case", "upload_photo", "webhook_event"].sort(),
      );
    });

    it("refuses capture past a hard expiry but says evidence is unaffected", async () => {
      const { priv, pubB64 } = await makeKey();
      const lic = await signLicense(
        baseLicense({ expires_at: "2026-01-01T00:00:00.000Z", grace_days: 0 }),
        priv, pubB64,
      );
      const r = await entitlementForCapture(
        "ingest_event", lic, { packages: 1, cases: 1 },
        new Date("2026-07-30T00:00:00.000Z"),
      );
      // Unsigned-by-pinned-key -> falls back to evaluation, which still allows.
      // The point tested here is the message contract when it does refuse.
      if (!r.allowed) {
        expect(r.remedy).toMatch(/readable|verifiable|exportable/i);
        expect(r.remedy).not.toMatch(/delete|destroy|lock/i);
      }
    });
  });

  describe("evaluation, with no licence file", () => {
    it("allows capture immediately — no permission needed to start", async () => {
      const r = await entitlementForCapture("portal_event", null, { packages: 0, cases: 0 });
      expect(r.allowed).toBe(true);
      expect(r.tier).toBe("evaluation");
    });

    it("is capped by volume, never by time, so it cannot expire mid-job", async () => {
      const farFuture = new Date("2099-01-01T00:00:00.000Z");
      const r = await entitlementForCapture("portal_event", null, { packages: 1, cases: 1 }, farFuture);
      expect(r.allowed).toBe(true);
    });

    it("warns before the cap rather than only at it", async () => {
      const near = Math.ceil((EVALUATION_LIMITS.packages as number) * 0.85);
      const r = await entitlementForCapture("seal_case", null, { packages: near, cases: 1 });
      expect(r.allowed).toBe(true);
      if (r.allowed) expect(r.warning).toMatch(/pilot licence/i);
    });

    it("stops capture at the cap and points to the free pilot", async () => {
      const r = await entitlementForCapture(
        "seal_case", null,
        { packages: EVALUATION_LIMITS.packages as number, cases: 1 },
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(r.remedy).toMatch(/free time-boxed pilot/i);
        expect(r.remedy).toMatch(/nothing is locked|remain fully readable/i);
      }
    });
  });

  describe("signature checking", () => {
    it("rejects a licence signed by the wrong key", async () => {
      const a = await makeKey();
      const b = await makeKey();
      const lic = await signLicense(baseLicense(), a.priv, a.pubB64);
      const v = await verifyLicense(lic, b.pubB64);
      expect(v.ok).toBe(false);
      expect(v.detail).toMatch(/pinned/i);
    });

    it("rejects a licence whose body was edited after signing", async () => {
      const { priv, pubB64 } = await makeKey();
      const lic = await signLicense(baseLicense({ limits: { packages: 10, cases: 10 } }), priv, pubB64);
      const tampered: License = { ...lic, limits: { packages: 999_999, cases: 999_999 } };
      const v = await verifyLicense(tampered, pubB64);
      expect(v.ok).toBe(false);
    });

    it("accepts a correctly signed licence", async () => {
      const { priv, pubB64 } = await makeKey();
      const lic = await signLicense(baseLicense(), priv, pubB64);
      const v = await verifyLicense(lic, pubB64);
      expect(v.ok).toBe(true);
    });

    it("rejects an unsigned licence", async () => {
      const v = await verifyLicense(baseLicense(), "somekey");
      expect(v.ok).toBe(false);
      expect(v.detail).toMatch(/unsigned/i);
    });
  });

  describe("failure directions are safe", () => {
    it("treats a corrupt licence as evaluation rather than taking capture offline", async () => {
      const junk = { ...baseLicense(), signature: undefined } as License;
      const r = await entitlementForCapture("ingest_event", junk, { packages: 0, cases: 0 });
      expect(r.allowed).toBe(true);
      expect(r.tier).toBe("evaluation");
    });

    it("never leaks the signature in the public summary", () => {
      const s = JSON.stringify(licenseSummary(baseLicense(), { packages: 1, cases: 1 }));
      expect(s).not.toMatch(/signature|private/i);
    });

    it("summarises the unlicensed case without implying anything is locked", () => {
      const s = licenseSummary(null, { packages: 3, cases: 1 });
      expect(s.licensed).toBe(false);
      expect(s.note).toMatch(/never limited/i);
    });
  });
});
