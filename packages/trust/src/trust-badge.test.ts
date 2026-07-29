import { describe, expect, it } from "vitest";
import { generateSigningKeyPair } from "@imagineqira/qev-core";
import {
  issueWorkflowCertificate,
  assertIssuable,
  ISSUABLE_NOW,
} from "./workflow-badge.js";

describe("workflow badge eligibility", () => {
  it("allows pilot levels only", () => {
    expect(ISSUABLE_NOW).toContain("qev_compatible");
    expect(() => assertIssuable("qev_protected_workflow")).toThrow(/not issuable/);
  });

  it("issues pilot configuration certificate", async () => {
    const key = generateSigningKeyPair("t");
    const cert = await issueWorkflowCertificate({
      level: "qev_pilot_configuration_passed",
      legal_name: "Test Co",
      domain: "test.example",
      workspace: "Field",
      environment: "development",
      flow_id: "field-service",
      flow_version: "0.1.0",
      included_systems: ["portal"],
      excluded_systems: ["payroll"],
      scope_sentence: "Field-service estimates through completion.",
      controls: { package_encryption: "pass" },
      signingKey: key,
    });
    expect(cert.schema).toBe("qev.trust-certificate.v1");
    expect(cert.status).toBe("active");
    expect(cert.badge_disclaimer).toMatch(/proves nothing/i);
  });
});
