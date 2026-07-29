/**
 * End-to-end vertical slice demo against a running gateway.
 *
 *   pnpm dev:gateway   # terminal 1
 *   pnpm demo:vertical # terminal 2
 */
import { createHash, createHmac } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.QEV_ENDPOINT ?? "http://127.0.0.1:7443";
const secret = process.env.QEV_WEBHOOK_SECRET ?? "dev-webhook-secret-change-me";
const token = process.env.QEV_INGEST_TOKEN ?? "dev-ingest-token-change-me";
const passphrase =
  process.env.QEV_PACKAGE_PASSPHRASE ?? "change-me-for-local-dev-only";

function hmac(body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function main() {
  console.log("== QEV vertical slice demo ==");
  console.log("gateway:", base);

  const health = await fetch(`${base}/healthz`);
  if (!health.ok) {
    throw new Error(`Gateway not healthy at ${base}. Start with: pnpm dev:gateway`);
  }
  console.log("health:", await health.json());

  const caseId = `CHG-DEMO-${Date.now()}`;
  const artifactBytes = Buffer.from(`build artifact for ${caseId}`);
  const artifactSha = createHash("sha256").update(artifactBytes).digest("hex");

  // 1) signed webhook event
  const webhookBody = JSON.stringify({
    flow_id: "devops-change",
    case_id: caseId,
    action: "deployment.completed",
    actor: { id: "demo@imagineqira.com", display_name: "Demo Operator" },
    outcome: "success",
    provider_event_id: `demo-${Date.now()}`,
    artifacts: [
      {
        name: "app-staging.tar.gz",
        sha256: artifactSha,
        size_bytes: artifactBytes.byteLength,
      },
    ],
    payload: {
      environment: "staging",
      commit: "deadbeef",
      pipeline: "demo-ci",
    },
  });

  const wh = await fetch(`${base}/v1/webhooks/demo-ci`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-qev-signature": `sha256=${hmac(webhookBody)}`,
    },
    body: webhookBody,
  });
  const receipt = await wh.json();
  console.log("webhook receipt:", receipt);
  if (!wh.ok) process.exit(1);

  // 2) SDK-style second event via /v1/events
  const sdkEvent = {
    schema: "qev.event.v1",
    event_id: `sdk_${Date.now()}`,
    occurred_at: new Date().toISOString(),
    observed_at: new Date().toISOString(),
    tenant_id: "local-dev",
    flow_id: "devops-change",
    case_id: caseId,
    source: {
      system: "demo-app",
      connector: "sdk-js",
      connector_version: "0.1.0",
      ingestion_path: "sdk",
    },
    actor: {
      id: "demo@imagineqira.com",
      identity_assurance: "source_asserted",
    },
    action: "tests.passed",
    outcome: "success",
    privacy: { default_mode: "full" },
    payload: { suite: "unit", passed: 12 },
    known_gaps: [],
  };

  const ev = await fetch(`${base}/v1/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ event: sdkEvent }),
  });
  console.log("sdk event:", await ev.json());
  if (!ev.ok) process.exit(1);

  // 3) seal package
  const complete = await fetch(`${base}/v1/flows/devops-change/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ case_id: caseId, passphrase }),
  });
  const sealed = await complete.json();
  console.log("sealed:", sealed);
  if (!complete.ok) process.exit(1);

  // 4) verify
  const packageId = sealed.package_id as string;
  const verify = await fetch(`${base}/v1/packages/${packageId}/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ passphrase }),
  });
  const report = await verify.json();
  console.log("verify:", report);

  const storageDir = path.resolve("data/packages");
  const files = await readdir(storageDir).catch(() => []);
  console.log("packages on disk:", files.filter((f) => f.includes(packageId)));

  if (!report.overall_ok) {
    console.error("VERTICAL SLICE FAILED");
    process.exit(1);
  }
  console.log("\nVERTICAL SLICE OK");
  console.log(`Package: data/packages/${packageId}.qevpkg.json`);
  console.log(
    `Verify CLI: pnpm verify -- data/packages/${packageId}.qevpkg.json --passphrase '${passphrase}'`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
