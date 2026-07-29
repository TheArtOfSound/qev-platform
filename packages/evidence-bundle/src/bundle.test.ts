import { describe, expect, it } from "vitest";
import type { QevEventV1 } from "@imagineqira/qev-event-schema";
import { buildEvidenceBundle } from "./build.js";
import { verifyEvidenceBundle } from "./verify.js";

const event: QevEventV1 = {
  schema: "qev.event.v1",
  event_id: "e1",
  occurred_at: "2026-07-29T00:00:00.000Z",
  observed_at: "2026-07-29T00:00:01.000Z",
  tenant_id: "t",
  flow_id: "devops-change",
  case_id: "CHG-1",
  source: {
    system: "ci",
    connector: "generic-webhook",
    connector_version: "0.1.0",
  },
  actor: { id: "alice", identity_assurance: "source_asserted" },
  action: "deployment.completed",
  outcome: "success",
  artifacts: [{ name: "app.tgz", sha256: "b".repeat(64) }],
  privacy: { default_mode: "full" },
  known_gaps: [],
};

describe("evidence bundle", () => {
  it("builds and verifies", () => {
    const bundle = buildEvidenceBundle({ events: [event] });
    const report = verifyEvidenceBundle(bundle);
    expect(report.overall_ok).toBe(true);
    expect(report.event_count).toBe(1);
  });

  it("detects tamper", () => {
    const bundle = buildEvidenceBundle({ events: [event] });
    bundle.events[0]!.action = "tampered";
    const report = verifyEvidenceBundle(bundle);
    expect(report.events_hash_ok).toBe(false);
    expect(report.overall_ok).toBe(false);
  });
});
