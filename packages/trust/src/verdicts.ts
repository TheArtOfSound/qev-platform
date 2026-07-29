/**
 * Multi-verdict trust report — never a single green "Verified" badge.
 */
import type { EvidenceBundleV1, QevEventV1 } from "@imagineqira/qev-event-schema";
import { verifyEvidenceBundle } from "@imagineqira/qev-evidence-bundle";
import type { QevPackageFile } from "@imagineqira/qev-core";
import type { FlowPack } from "./flow-types.js";

export type VerdictLevel =
  | "verified"
  | "partial"
  | "failed"
  | "not_present"
  | "not_applicable"
  | "not_determined";

export interface VerdictLine {
  id: string;
  label: string;
  level: VerdictLevel;
  detail: string;
}

export interface MultiVerdictReport {
  package_id: string;
  case_id: string;
  flow_id: string;
  lines: VerdictLine[];
  required_evidence: { have: number; need: number; missing: string[] };
  known_gaps: EvidenceBundleV1["known_gaps"];
  timeline: Array<{
    at: string;
    action: string;
    actor: string;
    source: string;
    event_id: string;
  }>;
  /** Explicit non-claims */
  content_truth: "not_independently_determined";
  shadow_mode?: boolean;
  overall_safe_to_rely_for: string[];
  overall_not_safe_to_rely_for: string[];
}

export function buildMultiVerdict(opts: {
  pkg: QevPackageFile;
  bundle: EvidenceBundleV1;
  vault_sha256_ok: boolean;
  decrypt_ok: boolean;
  flowPack?: FlowPack;
  shadow_mode?: boolean;
  webhook_signature_on_events?: boolean;
  /** Outer QEV-PACKAGE-V1 Ed25519 verification */
  package_signer?: {
    level: VerdictLevel;
    detail: string;
  };
}): MultiVerdictReport {
  const bundleReport = verifyEvidenceBundle(opts.bundle);
  const lines: VerdictLine[] = [];

  lines.push({
    id: "package_integrity",
    label: "Package integrity",
    level:
      opts.vault_sha256_ok && bundleReport.events_hash_ok && bundleReport.bundle_hash_ok
        ? "verified"
        : "failed",
    detail: opts.vault_sha256_ok
      ? "Outer vault_sha256 and evidence digests match recorded values"
      : "Outer vault_sha256 mismatch or evidence digests failed",
  });

  const signer = opts.package_signer ?? {
    level: opts.pkg.package_signature
      ? ("partial" as VerdictLevel)
      : opts.bundle.package_signature
        ? ("partial" as VerdictLevel)
        : ("not_present" as VerdictLevel),
    detail: opts.pkg.package_signature
      ? "Outer package_signature present — run verifyOuterPackageSignature for cryptographic check"
      : opts.bundle.package_signature
        ? `Inner bundle signature algorithm ${opts.bundle.package_signature.algorithm}`
        : "No organization package signature",
  };
  lines.push({
    id: "package_signer",
    label: "Package signer",
    level: signer.level,
    detail: signer.detail,
  });


  const webhookEvents = opts.bundle.events.filter(
    (e) => e.source.ingestion_path === "webhook",
  );
  lines.push({
    id: "source_webhook",
    label: "Source webhook",
    level:
      webhookEvents.length === 0
        ? "not_applicable"
        : webhookEvents.every((e) => e.source.raw_body_sha256)
          ? "verified"
          : "partial",
    detail:
      webhookEvents.length === 0
        ? "No webhook-ingested events in this package"
        : "Raw body SHA-256 bound on webhook events (HMAC verified at ingest)",
  });

  const assurances = new Set(
    opts.bundle.events.map((e) => e.actor.identity_assurance),
  );
  lines.push({
    id: "actor_identity",
    label: "Actor identity",
    level: "partial",
    detail: `Strongest recorded: ${[...assurances].join(", ") || "none"}`,
  });

  const arts = opts.bundle.artifacts ?? [];
  const wellFormed = arts.filter((a) => /^[a-f0-9]{64}$/.test(a.sha256));
  lines.push({
    id: "artifact_match",
    label: "Artifact fingerprints",
    level:
      arts.length === 0
        ? "not_present"
        : wellFormed.length === arts.length
          ? "verified"
          : "partial",
    detail:
      arts.length === 0
        ? "No artifact fingerprints recorded"
        : `${wellFormed.length}/${arts.length} well-formed SHA-256 fingerprints (content truth not re-fetched)`,
  });

  const hasIndependent = opts.bundle.events.some(
    (e) => e.time_assurance?.independent_timestamp,
  );
  lines.push({
    id: "time",
    label: "Time",
    level: hasIndependent ? "verified" : "partial",
    detail: hasIndependent
      ? "Independent timestamp present on at least one event"
      : "Gateway observed and/or source system time only",
  });

  lines.push({
    id: "external_time_anchor",
    label: "External time anchor",
    level: hasIndependent ? "verified" : "not_present",
    detail: hasIndependent
      ? "RFC 3161-style or independent timestamp recorded"
      : "Not present (optional for pilot)",
  });

  const required = opts.flowPack?.required_actions ?? [];
  const present = new Set(opts.bundle.events.map((e) => e.action));
  const missing = required.filter((a) => !present.has(a));
  lines.push({
    id: "required_evidence",
    label: "Required evidence",
    level:
      required.length === 0
        ? "not_applicable"
        : missing.length === 0
          ? "verified"
          : "partial",
    detail:
      required.length === 0
        ? "No required action list on flow pack"
        : `${required.length - missing.length} of ${required.length} required actions present`,
  });

  lines.push({
    id: "content_truth",
    label: "Content truth",
    level: "not_determined",
    detail: "QEV does not independently determine whether source content is true",
  });

  lines.push({
    id: "post_seal",
    label: "Post-seal rewrite",
    level: "verified",
    detail:
      "Sealed packages are immutable; late events must open a new package or known gap",
  });

  if (opts.shadow_mode) {
    lines.push({
      id: "shadow_mode",
      label: "Shadow mode",
      level: "partial",
      detail: "Recording only — QEV did not control or block the business process",
    });
  }

  const timeline = opts.bundle.events
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((e: QevEventV1) => ({
      at: e.occurred_at,
      action: e.action,
      actor: e.actor.display_name ?? e.actor.id,
      source: `${e.source.system} / ${e.source.connector}`,
      event_id: e.event_id,
    }));

  return {
    package_id: opts.pkg.package_id,
    case_id: opts.pkg.case_id,
    flow_id: opts.pkg.flow_id,
    lines,
    required_evidence: {
      have: required.length - missing.length,
      need: required.length,
      missing,
    },
    known_gaps: opts.bundle.known_gaps,
    timeline,
    content_truth: "not_independently_determined",
    shadow_mode: opts.shadow_mode,
    overall_safe_to_rely_for: [
      "Whether sealed package bytes match integrity digests",
      "Whether decrypt succeeded with authorized unlock",
      "Which events and artifact hashes were recorded",
      "Which required flow steps are present or missing",
    ],
    overall_not_safe_to_rely_for: [
      "Truth of statements inside source systems",
      "Legal privilege or court admissibility",
      "That unlogged actions never occurred",
      "Identity stronger than recorded identity_assurance",
    ],
  };
}
