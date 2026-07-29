import { describe, expect, it } from "vitest";
import { encryptVaultV2, decryptVaultV2Text } from "./vault.js";
import {
  sealEvidencePackage,
  openEvidencePackage,
  verifyOuterPackageSignature,
} from "./package-file.js";
import { generateSigningKeyPair } from "./signing.js";

describe("Vault V2 + package seal", () => {
  it("round-trips evidence through vault", async () => {
    const vault = await encryptVaultV2({
      plaintext: '{"hello":"world"}',
      password: "correct horse battery staple",
      preset: "quick",
    });
    const text = await decryptVaultV2Text(vault, "correct horse battery staple");
    expect(text).toBe('{"hello":"world"}');
  });

  it("rejects wrong passphrase", async () => {
    const vault = await encryptVaultV2({
      plaintext: "secret",
      password: "right",
      preset: "quick",
    });
    await expect(decryptVaultV2Text(vault, "wrong")).rejects.toThrow(/Wrong passphrase/);
  });

  it("seals and opens QEV-PACKAGE-V1", async () => {
    const pkg = await sealEvidencePackage({
      packageId: "pkg_test",
      tenantId: "t1",
      flowId: "devops-change",
      caseId: "CHG-1",
      evidenceBundleJson: JSON.stringify({ schema: "QEV-EVIDENCE-BUNDLE-V1", events: [] }),
      password: "test-pass",
      publicMeta: {
        event_count: 1,
        outcome: "complete",
        integrity_events_sha256: "a".repeat(64),
      },
    });
    expect(pkg.schema).toBe("QEV-PACKAGE-V1");
    const opened = await openEvidencePackage(pkg, "test-pass");
    expect(opened.vault_sha256_ok).toBe(true);
    expect(JSON.parse(opened.evidenceJson).schema).toBe("QEV-EVIDENCE-BUNDLE-V1");
  });

  it("Ed25519 signs and verifies package commitment", async () => {
    const key = generateSigningKeyPair("test-key");
    const pkg = await sealEvidencePackage({
      packageId: "pkg_signed",
      tenantId: "t1",
      flowId: "field-service",
      caseId: "JOB-1",
      evidenceBundleJson: JSON.stringify({ schema: "QEV-EVIDENCE-BUNDLE-V1", events: [1] }),
      password: "test-pass",
      publicMeta: {
        event_count: 1,
        outcome: "complete",
        integrity_events_sha256: "b".repeat(64),
      },
      signingKey: key,
    });
    expect(pkg.package_signature?.algorithm).toBe("Ed25519");
    const v = await verifyOuterPackageSignature(pkg);
    expect(v.level).toBe("verified");
    // Tamper vault_sha256 claim
    pkg.vault_sha256 = "c".repeat(64);
    const bad = await verifyOuterPackageSignature(pkg);
    expect(bad.level).toBe("failed");
  });
});

