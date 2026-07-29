/**
 * On-disk commercial package wrapper.
 *
 * Outer file: QEV-PACKAGE-V1 JSON with public metadata + sealed Vault V2.
 * Inner plaintext (after decrypt): QEV-EVIDENCE-BUNDLE-V1 JSON.
 *
 * This keeps Vault V2 as the encryption core without overloading the
 * browser one-off secret format for multi-event enterprise records.
 */
import type { QevVault } from "./vault.js";
import {
  encryptVaultV2,
  decryptVaultV2Text,
  type PresetKey,
} from "./vault.js";
import { sha256Hex } from "@imagineqira/qev-shared";
import {
  buildPackageSignPayload,
  signPackagePayload,
  verifyPackageSignature,
  type PackageSignature,
  type SigningKeyPair,
} from "./signing.js";

export const PACKAGE_SCHEMA = "QEV-PACKAGE-V1";

export interface QevPackageFile {
  schema: typeof PACKAGE_SCHEMA;
  package_id: string;
  created_at: string;
  tenant_id: string;
  flow_id: string;
  case_id: string;
  /** Non-sensitive summary for listing without decrypt. */
  public_meta: {
    title?: string;
    event_count: number;
    outcome: string;
    integrity_events_sha256: string;
    package_kind?: "primary" | "supplemental";
    parent_package_id?: string;
    sealed_event_ids?: string[];
  };
  /** Sealed Vault V2 envelope holding Evidence Bundle V1 plaintext. */
  vault: QevVault;
  /** SHA-256 of canonical vault JSON for transport integrity. */
  vault_sha256: string;
  /** Optional organization Ed25519 signature over public commitment. */
  package_signature?: PackageSignature;
}

export async function sealEvidencePackage(opts: {
  packageId: string;
  tenantId: string;
  flowId: string;
  caseId: string;
  evidenceBundleJson: string;
  password: string;
  publicMeta: QevPackageFile["public_meta"];
  preset?: PresetKey;
  signingKey?: SigningKeyPair;
}): Promise<QevPackageFile> {
  const vault = await encryptVaultV2({
    plaintext: opts.evidenceBundleJson,
    password: opts.password,
    mode: "self",
    preset: opts.preset ?? "quick",
  });
  const vaultJson = JSON.stringify(vault);
  const vault_sha256 = sha256Hex(vaultJson);
  const created_at = new Date().toISOString();
  const pkg: QevPackageFile = {
    schema: PACKAGE_SCHEMA,
    package_id: opts.packageId,
    created_at,
    tenant_id: opts.tenantId,
    flow_id: opts.flowId,
    case_id: opts.caseId,
    public_meta: opts.publicMeta,
    vault,
    vault_sha256,
  };
  if (opts.signingKey) {
    const payload = buildPackageSignPayload({
      package_id: pkg.package_id,
      tenant_id: pkg.tenant_id,
      flow_id: pkg.flow_id,
      case_id: pkg.case_id,
      vault_sha256: pkg.vault_sha256,
      integrity_events_sha256: pkg.public_meta.integrity_events_sha256,
      created_at: pkg.created_at,
    });
    pkg.package_signature = await signPackagePayload(payload, opts.signingKey);
  }
  return pkg;
}

export async function verifyOuterPackageSignature(
  pkg: QevPackageFile,
): Promise<{ ok: boolean; detail: string; level: "verified" | "not_present" | "failed" }> {
  if (!pkg.package_signature) {
    return {
      ok: false,
      detail: "No organization package signature present",
      level: "not_present",
    };
  }
  const payload = buildPackageSignPayload({
    package_id: pkg.package_id,
    tenant_id: pkg.tenant_id,
    flow_id: pkg.flow_id,
    case_id: pkg.case_id,
    vault_sha256: pkg.vault_sha256,
    integrity_events_sha256: pkg.public_meta.integrity_events_sha256,
    created_at: pkg.created_at,
  });
  const r = await verifyPackageSignature(payload, pkg.package_signature);
  return {
    ok: r.ok,
    detail: r.detail,
    level: r.ok ? "verified" : "failed",
  };
}

export async function openEvidencePackage(
  pkg: QevPackageFile,
  password: string,
): Promise<{
  evidenceJson: string;
  vault_sha256_ok: boolean;
}> {
  if (pkg.schema !== PACKAGE_SCHEMA) {
    throw new Error(`Unsupported package schema: ${pkg.schema}`);
  }
  const vaultJson = JSON.stringify(pkg.vault);
  const vault_sha256_ok = sha256Hex(vaultJson) === pkg.vault_sha256;
  const evidenceJson = await decryptVaultV2Text(pkg.vault, password);
  return { evidenceJson, vault_sha256_ok };
}
