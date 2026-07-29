/**
 * Company workflow trust badges — narrow, scoped, revocable.
 *
 * Eligibility NOW (controlled-use product):
 * - qev_compatible (interop tests)
 * - qev_pilot_configuration_passed (internal pilot only — not public "Protected")
 *
 * NOT issuable until platform + external assessment:
 * - qev_verified_workflow
 * - qev_protected_workflow
 * - qev_independently_assessed
 */
import {
  signPackagePayload,
  type PackageSignature,
  type SigningKeyPair,
} from "@imagineqira/qev-core";
import { canonicalJSON, sha256Hex, newId } from "@imagineqira/qev-shared";

export const TRUST_CERT_SCHEMA = "qev.trust-certificate.v1" as const;

export type TrustBadgeLevel =
  | "qev_compatible"
  | "qev_pilot_configuration_passed"
  | "qev_verified_workflow"
  | "qev_protected_workflow"
  | "qev_independently_assessed";

export type TrustCertStatus =
  | "active"
  | "expiring"
  | "suspended"
  | "revoked"
  | "expired"
  | "superseded"
  | "draft";

/** Levels Qira may auto-issue today without overclaiming. */
export const ISSUABLE_NOW: TrustBadgeLevel[] = [
  "qev_compatible",
  "qev_pilot_configuration_passed",
];

export const PUBLIC_BADGE_LABEL: Record<TrustBadgeLevel, string> = {
  qev_compatible: "QEV Compatible",
  qev_pilot_configuration_passed: "QEV Pilot Configuration Passed",
  qev_verified_workflow: "QEV Verified Workflow",
  qev_protected_workflow: "QEV Protected Workflow",
  qev_independently_assessed: "QEV Independently Assessed",
};

export interface WorkflowTrustCertificate {
  schema: typeof TRUST_CERT_SCHEMA;
  certificate_id: string;
  subject: {
    legal_name: string;
    domain: string;
  };
  level: TrustBadgeLevel;
  public_label: string;
  scope: {
    workspace: string;
    environment: string;
    flow_id: string;
    flow_version: string;
    included_systems: string[];
    excluded_systems: string[];
    scope_sentence: string;
  };
  controls: Record<string, "pass" | "fail" | "not_tested" | "n_a">;
  issued_at: string;
  expires_at: string;
  last_health_check?: string;
  status: TrustCertStatus;
  assessor: {
    type: string;
    name: string;
  };
  exceptions: string[];
  revocation_reason?: string;
  public_key_fingerprint: string;
  signature?: PackageSignature;
  certificate_sha256: string;
  badge_disclaimer: string;
}

export function assertIssuable(level: TrustBadgeLevel): void {
  if (!ISSUABLE_NOW.includes(level)) {
    throw new Error(
      `Level ${level} is not issuable yet. Public product is controlled-use preview without independent audit / full KMS. Stronger badges require assessment process.`,
    );
  }
}

export async function issueWorkflowCertificate(opts: {
  level: TrustBadgeLevel;
  legal_name: string;
  domain: string;
  workspace: string;
  environment: string;
  flow_id: string;
  flow_version: string;
  included_systems: string[];
  excluded_systems: string[];
  scope_sentence: string;
  controls: WorkflowTrustCertificate["controls"];
  exceptions?: string[];
  signingKey: SigningKeyPair;
  ttl_days?: number;
}): Promise<WorkflowTrustCertificate> {
  assertIssuable(opts.level);
  const issued_at = new Date().toISOString();
  const ttl = opts.ttl_days ?? 90;
  const expires_at = new Date(Date.now() + ttl * 86400000).toISOString();
  const certificate_id = `QEV-${new Date().getUTCFullYear()}-${newId("").slice(0, 6).toUpperCase()}`;

  const base: Omit<WorkflowTrustCertificate, "certificate_sha256" | "signature"> = {
    schema: TRUST_CERT_SCHEMA,
    certificate_id,
    subject: {
      legal_name: opts.legal_name,
      domain: opts.domain,
    },
    level: opts.level,
    public_label: PUBLIC_BADGE_LABEL[opts.level],
    scope: {
      workspace: opts.workspace,
      environment: opts.environment,
      flow_id: opts.flow_id,
      flow_version: opts.flow_version,
      included_systems: opts.included_systems,
      excluded_systems: opts.excluded_systems,
      scope_sentence: opts.scope_sentence,
    },
    controls: opts.controls,
    issued_at,
    expires_at,
    last_health_check: issued_at,
    status: "active",
    assessor: {
      type:
        opts.level === "qev_compatible"
          ? "qev_interop_tests"
          : "qev_automated_pilot_preflight",
      name: "Qira (self-issued pilot)",
    },
    exceptions: opts.exceptions ?? [
      "Not an independent security audit",
      "Does not cover company systems outside declared scope",
    ],
    public_key_fingerprint: opts.signingKey.public_key.slice(0, 24),
    badge_disclaimer:
      "The badge graphic proves nothing. Only the linked signed certificate and live status matter. Scope is limited to the named workflow.",
  };

  const toHash = { ...base, certificate_sha256: "", signature: undefined };
  const certificate_sha256 = sha256Hex(canonicalJSON(toHash));
  const payload = canonicalJSON({
    certificate_id,
    certificate_sha256,
    level: opts.level,
    domain: opts.domain,
    flow_id: opts.flow_id,
    issued_at,
    expires_at,
  });
  const signature = await signPackagePayload(payload, opts.signingKey);

  return {
    ...base,
    certificate_sha256,
    signature,
  };
}

/** SVG is decorative only — must always link to verification URL. */
export function badgeSvg(opts: {
  label: string;
  scope_short: string;
  status: TrustCertStatus;
  verify_url: string;
}): string {
  const color =
    opts.status === "active"
      ? "#3ecf8e"
      : opts.status === "suspended" || opts.status === "revoked"
        ? "#f07178"
        : "#e6b84d";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" role="img" aria-label="${opts.label}">
  <title>${opts.label} — verify at ${opts.verify_url}</title>
  <rect width="320" height="72" rx="8" fill="#1a222c" stroke="${color}" />
  <text x="16" y="28" fill="#e7eef7" font-family="system-ui,sans-serif" font-size="14" font-weight="700">${opts.label}</text>
  <text x="16" y="48" fill="#8b9bb0" font-family="system-ui,sans-serif" font-size="10">${opts.scope_short}</text>
  <text x="16" y="64" fill="#8b9bb0" font-family="system-ui,sans-serif" font-size="9">Status: ${opts.status} · Certificate is evidence, not this image</text>
</svg>`;
}
