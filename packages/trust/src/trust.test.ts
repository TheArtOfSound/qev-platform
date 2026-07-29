import { describe, expect, it } from "vitest";
import { buildMultiVerdict } from "./verdicts.js";
import { FIELD_SERVICE_PACK } from "./field-service.js";
import type { EvidenceBundleV1 } from "@imagineqira/qev-event-schema";
import type { QevPackageFile } from "@imagineqira/qev-core";
import { buildEvidenceBundle } from "@imagineqira/qev-evidence-bundle";

describe("multi-verdict", () => {
  it("reports required evidence gaps", () => {
    const events = [
      {
        schema: "qev.event.v1" as const,
        event_id: "e1",
        occurred_at: "2026-07-01T10:00:00.000Z",
        observed_at: "2026-07-01T10:00:01.000Z",
        tenant_id: "t",
        flow_id: "field-service",
        case_id: "JOB-1",
        source: {
          system: "portal",
          connector: "job-portal",
          connector_version: "0.1.0",
          ingestion_path: "sdk" as const,
        },
        actor: { id: "cust@x.com", identity_assurance: "source_asserted" as const },
        action: "job.created",
        outcome: "success" as const,
        privacy: { default_mode: "full" as const },
        known_gaps: [],
      },
    ];
    const bundle = buildEvidenceBundle({ events });
    const pkg = {
      schema: "QEV-PACKAGE-V1",
      package_id: bundle.package_id,
      created_at: bundle.created_at,
      tenant_id: "t",
      flow_id: "field-service",
      case_id: "JOB-1",
      public_meta: {
        event_count: 1,
        outcome: "incomplete",
        integrity_events_sha256: bundle.integrity.events_sha256,
      },
      vault: {} as QevPackageFile["vault"],
      vault_sha256: "a".repeat(64),
    } as QevPackageFile;

    const report = buildMultiVerdict({
      pkg,
      bundle: bundle as EvidenceBundleV1,
      vault_sha256_ok: true,
      decrypt_ok: true,
      flowPack: FIELD_SERVICE_PACK,
      shadow_mode: true,
    });

    expect(report.required_evidence.missing.length).toBeGreaterThan(0);
    expect(report.content_truth).toBe("not_independently_determined");
    expect(report.lines.some((l) => l.id === "content_truth")).toBe(true);
  });
});
