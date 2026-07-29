/**
 * Evidence-package seal certificate (per package).
 * Distinct from company workflow badges.
 */
import {
  buildPackageSignPayload,
  signPackagePayload,
  type PackageSignature,
  type SigningKeyPair,
  type QevPackageFile,
} from "@imagineqira/qev-core";
import type { EvidenceBundleV1 } from "@imagineqira/qev-event-schema";
import { sha256Hex, canonicalJSON } from "@imagineqira/qev-shared";
/** Avoid circular import with @imagineqira/qev-ops */
export interface CompletenessSnapshot {
  percent: number;
  required_present: number;
  required_total: number;
  required_missing?: string[];
  missing?: string[];
}

export const SEAL_CERT_SCHEMA = "qev.package-seal-certificate.v1" as const;

export interface PackageSealCertificate {
  schema: typeof SEAL_CERT_SCHEMA;
  certificate_id: string;
  package_id: string;
  package_hash: string;
  vault_sha256: string;
  qev_gateway_version: string;
  qev_core_version: string;
  issuing_organization: {
    tenant_id: string;
    key_id: string;
  };
  flow_id: string;
  case_id: string;
  created_at: string;
  sealed_at: string;
  signature: PackageSignature;
  signature_result: "valid_when_verified" | "unsigned";
  artifact_count: number;
  artifact_fingerprints: Array<{ name: string; sha256: string }>;
  evidence_completeness: {
    percent: number;
    required_present: number;
    required_total: number;
    missing: string[];
  };
  known_gaps: EvidenceBundleV1["known_gaps"];
  package_kind: "primary" | "supplemental";
  parent_package_id?: string;
  verification_instructions: string[];
  /** Explicit non-claims */
  does_not_claim: string[];
  certificate_sha256: string;
}

export async function buildPackageSealCertificate(opts: {
  pkg: QevPackageFile;
  bundle: EvidenceBundleV1;
  signingKey: SigningKeyPair;
  completeness?: CompletenessSnapshot | null;
  gatewayVersion?: string;
  packageKind?: "primary" | "supplemental";
  parentPackageId?: string;
}): Promise<PackageSealCertificate> {
  const sealed_at = new Date().toISOString();
  const package_hash = sha256Hex(JSON.stringify(opts.pkg));
  const arts = (opts.bundle.artifacts ?? []).map((a) => ({
    name: a.name,
    sha256: a.sha256,
  }));
  const completeness = opts.completeness;

  const partial: Omit<PackageSealCertificate, "certificate_sha256" | "signature"> & {
    signature?: PackageSignature;
  } = {
    schema: SEAL_CERT_SCHEMA,
    certificate_id: `SEAL-${opts.pkg.package_id}`,
    package_id: opts.pkg.package_id,
    package_hash,
    vault_sha256: opts.pkg.vault_sha256,
    qev_gateway_version: opts.gatewayVersion ?? "0.3.0",
    qev_core_version: "0.1.0",
    issuing_organization: {
      tenant_id: opts.pkg.tenant_id,
      key_id: opts.signingKey.key_id,
    },
    flow_id: opts.pkg.flow_id,
    case_id: opts.pkg.case_id,
    created_at: opts.pkg.created_at,
    sealed_at,
    signature_result: "valid_when_verified",
    artifact_count: arts.length,
    artifact_fingerprints: arts,
    evidence_completeness: {
      percent: completeness?.percent ?? 0,
      required_present: completeness?.required_present ?? 0,
      required_total: completeness?.required_total ?? 0,
      missing: completeness?.required_missing ?? completeness?.missing ?? [],
    },
    known_gaps: opts.bundle.known_gaps ?? [],
    package_kind: opts.packageKind ?? "primary",
    parent_package_id: opts.parentPackageId,
    verification_instructions: [
      "1. Obtain the .qevpkg.json file and this certificate.",
      "2. Verify package_signature with the issuing public key (Ed25519).",
      "3. Confirm vault_sha256 matches the sealed vault JSON.",
      "4. Decrypt with an authorized unlock method.",
      "5. Verify evidence integrity.events_sha256 and integrity.bundle_sha256.",
      "6. Review multi-verdict output; content truth is not independently determined.",
    ],
    does_not_claim: [
      "Truth of source-system content",
      "Company-wide security posture",
      "Legal privilege or court admissibility",
      "That unlogged actions never occurred",
    ],
  };

  const payload = buildPackageSignPayload({
    package_id: opts.pkg.package_id,
    tenant_id: opts.pkg.tenant_id,
    flow_id: opts.pkg.flow_id,
    case_id: opts.pkg.case_id,
    vault_sha256: opts.pkg.vault_sha256,
    integrity_events_sha256: opts.pkg.public_meta.integrity_events_sha256,
    created_at: opts.pkg.created_at,
  });
  const signature = await signPackagePayload(payload, opts.signingKey);
  const withSig = { ...partial, signature };
  const certificate_sha256 = sha256Hex(
    canonicalJSON({ ...withSig, certificate_sha256: "" }),
  );
  return { ...withSig, certificate_sha256 };
}
