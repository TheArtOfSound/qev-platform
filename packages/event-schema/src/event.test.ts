import { describe, expect, it } from "vitest";
import { normalizeGenericWebhook } from "./normalize-webhook.js";
import { assertQevEventV1 } from "./validate.js";

describe("event schema", () => {
  it("normalizes generic webhook", () => {
    const raw = JSON.stringify({
      flow_id: "devops-change",
      case_id: "CHG-1",
      action: "deployment.completed",
      actor: { id: "alice@acme.com" },
      outcome: "success",
      artifacts: [
        {
          name: "app.tgz",
          sha256: "a".repeat(64),
        },
      ],
    });
    const body = JSON.parse(raw);
    const evt = normalizeGenericWebhook({
      body,
      rawBody: raw,
      tenantId: "local-dev",
      connectorId: "ci",
    });
    assertQevEventV1(evt);
    expect(evt.case_id).toBe("CHG-1");
    expect(evt.source.raw_body_sha256).toHaveLength(64);
    expect(evt.actor.identity_assurance).toBe("source_asserted");
  });
});
