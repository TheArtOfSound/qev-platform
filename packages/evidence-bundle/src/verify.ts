import { sha256Canonical } from "@imagineqira/qev-shared";
import type { EvidenceBundleV1 } from "@imagineqira/qev-event-schema";

export interface BundleVerifyReport {
  schema_ok: boolean;
  events_hash_ok: boolean;
  bundle_hash_ok: boolean;
  known_gaps: number;
  event_count: number;
  /** Exact claims — never use the word "proof" without naming the property. */
  claims: string[];
  failures: string[];
  overall_ok: boolean;
}

export function verifyEvidenceBundle(bundle: EvidenceBundleV1): BundleVerifyReport {
  const failures: string[] = [];
  const claims: string[] = [];

  const schema_ok = bundle.schema === "QEV-EVIDENCE-BUNDLE-V1";
  if (!schema_ok) failures.push("schema is not QEV-EVIDENCE-BUNDLE-V1");
  else claims.push("schema is QEV-EVIDENCE-BUNDLE-V1");

  const events_sha256 = sha256Canonical(bundle.events);
  const events_hash_ok = events_sha256 === bundle.integrity.events_sha256;
  if (!events_hash_ok) {
    failures.push("events content does not match integrity.events_sha256");
  } else {
    claims.push("events content matches integrity.events_sha256");
  }

  const forHash = {
    ...bundle,
    integrity: { ...bundle.integrity, bundle_sha256: "" },
  };
  const expected = sha256Canonical(forHash);
  const bundle_hash_ok = expected === bundle.integrity.bundle_sha256;
  if (!bundle_hash_ok) {
    failures.push("bundle content does not match integrity.bundle_sha256");
  } else {
    claims.push("bundle content matches integrity.bundle_sha256");
  }

  for (const a of bundle.artifacts ?? []) {
    if (!/^[a-f0-9]{64}$/.test(a.sha256)) {
      failures.push(`artifact ${a.name} has invalid sha256`);
    } else {
      claims.push(`artifact ${a.name} has a well-formed sha256 fingerprint`);
    }
  }

  const overall_ok = failures.length === 0;
  return {
    schema_ok,
    events_hash_ok,
    bundle_hash_ok,
    known_gaps: bundle.known_gaps.length,
    event_count: bundle.events.length,
    claims,
    failures,
    overall_ok,
  };
}
