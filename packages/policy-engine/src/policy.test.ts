import { describe, expect, it } from "vitest";
import type { QevEventV1 } from "@imagineqira/qev-event-schema";
import { evaluatePolicy } from "./engine.js";

function baseEvent(over: Partial<QevEventV1> = {}): QevEventV1 {
  return {
    schema: "qev.event.v1",
    event_id: "e1",
    occurred_at: new Date().toISOString(),
    observed_at: new Date().toISOString(),
    tenant_id: "t",
    flow_id: "devops-change",
    case_id: "c1",
    source: {
      system: "ci",
      connector: "generic-webhook",
      connector_version: "0.1.0",
    },
    actor: { id: "a", identity_assurance: "source_asserted" },
    action: "deployment.completed",
    outcome: "success",
    privacy: { default_mode: "full" },
    ...over,
  };
}

describe("policy engine", () => {
  it("blocks destructive action without backup", () => {
    const d = evaluatePolicy(
      baseEvent({ action: "infra.destroy", payload: {} }),
    );
    expect(d.effect).toBe("block");
  });

  it("allows destroy when backup present", () => {
    const d = evaluatePolicy(
      baseEvent({
        action: "infra.destroy",
        payload: { backup_status: "ok" },
      }),
    );
    expect(d.effect).not.toBe("block");
  });

  it("requires approval for prod deploy", () => {
    const d = evaluatePolicy(
      baseEvent({ action: "deployment.production" }),
    );
    expect(d.effect).toBe("require_approval");
  });
});
