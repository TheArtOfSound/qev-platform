import { describe, expect, it } from "vitest";
import { evaluateCompleteness } from "./completeness.js";
import { matchCase } from "./matching.js";
import { runPreflight } from "./preflight.js";
import { gateWouldBlock, normalizeMode } from "./modes.js";
import { FIELD_SERVICE_PACK } from "@imagineqira/qev-trust";
import type { QevEventV1 } from "@imagineqira/qev-event-schema";

function ev(action: string): QevEventV1 {
  return {
    schema: "qev.event.v1",
    event_id: action,
    occurred_at: new Date().toISOString(),
    observed_at: new Date().toISOString(),
    tenant_id: "t",
    flow_id: "field-service",
    case_id: "JOB-1",
    source: {
      system: "t",
      connector: "c",
      connector_version: "0.1.0",
    },
    actor: { id: "a", identity_assurance: "source_asserted" },
    action,
    outcome: "success",
    privacy: { default_mode: "full" },
  };
}

describe("ops", () => {
  it("completeness detects missing required", () => {
    const r = evaluateCompleteness([ev("job.created")], FIELD_SERVICE_PACK, "JOB-1");
    expect(r.complete_for_seal).toBe(false);
    expect(r.required_missing.length).toBeGreaterThan(0);
    expect(r.seal_allowed_in_shadow).toBe(true);
  });

  it("matches email subject job tags", () => {
    const m = matchCase({
      email_subject: "Re: [JOB-99] estimate ok",
      known_case_ids: ["JOB-99"],
    });
    expect(m.case_id).toBe("JOB-99");
    expect(m.confidence).toBe("high");
  });

  it("preflight blocks without signing key", () => {
    const r = runPreflight({
      gateway_reachable: true,
      storage_writable: true,
      backup_writable: true,
      signing_key_present: false,
      encryption_passphrase_configured: true,
      webhook_secret_configured: true,
      queue_healthy: true,
      case_log_chain_ok: true,
    });
    expect(r.can_activate).toBe(false);
  });

  it("gate would block incomplete seal", () => {
    expect(normalizeMode("live")).toBe("shadow");
    const g = gateWouldBlock({
      mode: "gate",
      action: "package.seal",
      hasChangeApproval: true,
      completenessOk: false,
    });
    expect(g.would_block).toBe(true);
  });
});
