import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { hmacSha256Hex } from "@imagineqira/qev-shared";
import { DurableQueue, CaseLog } from "@imagineqira/qev-runtime";
import { loadConfig } from "./config.js";
import { GatewayStore } from "./store.js";
import { SettingsStore } from "./settings.js";
import { SigningKeyStore } from "./keys.js";
import { createGateway } from "./server.js";


describe("gateway pilot slice", () => {
  let baseUrl = "";
  let server: ReturnType<typeof createServer>;
  let secret = "";
  let token = "";
  let passphrase = "";

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qev-gw-"));
    secret = "test-secret";
    token = "test-token";
    passphrase = "test-passphrase";
    const config = {
      ...loadConfig({
        QEV_DATA_DIR: dir,
        QEV_STORAGE_DIR: path.join(dir, "packages"),
        QEV_WEBHOOK_SECRET: secret,
        QEV_INGEST_TOKEN: token,
        QEV_PACKAGE_PASSPHRASE: passphrase,
        QEV_TENANT_ID: "test-tenant",
        QEV_SHADOW_MODE: "true",
      }),
      host: "127.0.0.1",
      port: 0,
    };
    const store = new GatewayStore(config.storageDir, config.eventsDir);
    const queue = new DurableQueue(config.queueDir);
    const caseLog = new CaseLog(config.caseLogDir);
    const settingsStore = new SettingsStore(config.settingsDir);
    const signingKeys = new SigningKeyStore(path.join(dir, "signing"));
    await store.init();
    await queue.init();
    await caseLog.init();
    await settingsStore.init();
    await signingKeys.init();
    const gw = createGateway(
      config,
      store,
      queue,
      caseLog,
      settingsStore,
      signingKeys,
    );
    server = gw.server;
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("rejects bad webhook signature", async () => {
    const body = JSON.stringify({ case_id: "X", action: "a" });
    const res = await fetch(`${baseUrl}/v1/webhooks/ci`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qev-signature": "sha256=" + "0".repeat(64),
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  it("field-service portal → photo → seal → multi-verdict", async () => {
    const caseId = "JOB-TEST-1";

    const create = await fetch(`${baseUrl}/v1/portal/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: caseId,
        action: "job.created",
        actor: { id: "customer@example.com", display_name: "Cust" },
        payload: { address: "123 Main" },
      }),
    });
    expect(create.status).toBe(202);

    for (const action of [
      "estimate.approved",
      "work.completed",
    ] as const) {
      const r = await fetch(`${baseUrl}/v1/portal/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          action,
          actor: { id: "customer@example.com" },
        }),
      });
      expect(r.status).toBe(202);
    }

    const photo = await fetch(`${baseUrl}/v1/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: caseId,
        kind: "before",
        filename: "before.jpg",
        content_base64: Buffer.from("fake-image-bytes").toString("base64"),
      }),
    });
    expect(photo.status).toBe(202);

    const after = await fetch(`${baseUrl}/v1/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: caseId,
        kind: "after",
        filename: "after.jpg",
        content_base64: Buffer.from("fake-after-bytes").toString("base64"),
      }),
    });
    expect(after.status).toBe(202);

    const complete = await fetch(`${baseUrl}/v1/flows/field-service/complete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ case_id: caseId, passphrase }),
    });
    expect(complete.status).toBe(201);
    const sealed = (await complete.json()) as { package_id: string };

    const verify = await fetch(
      `${baseUrl}/v1/packages/${sealed.package_id}/verify`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ passphrase }),
      },
    );
    expect(verify.status).toBe(200);
    const report = (await verify.json()) as {
      overall_ok: boolean;
      multi_verdict: {
        content_truth: string;
        lines: Array<{ id: string; level: string }>;
        required_evidence: { missing: string[] };
      };
    };
    expect(report.overall_ok).toBe(true);
    expect(report.multi_verdict.content_truth).toBe(
      "not_independently_determined",
    );
    expect(
      report.multi_verdict.lines.some((l) => l.id === "package_integrity"),
    ).toBe(true);
    expect(
      report.multi_verdict.lines.find((l) => l.id === "package_signer")?.level,
    ).toBe("verified");

    // /v1/preflight names internal paths and configuration state, so it
    // is authenticated now (audit F-15).
    const pf = await fetch(`${baseUrl}/v1/preflight`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pf.status).toBe(200);
    const preflight = (await pf.json()) as { can_activate: boolean };
    expect(preflight.can_activate).toBe(true);
  });


  it("signed webhook still works", async () => {
    const payload = {
      flow_id: "field-service",
      case_id: "JOB-WH-1",
      action: "invoice.issued",
      actor: { id: "billing@example.com" },
      outcome: "success",
      provider_event_id: "inv-1",
    };
    const body = JSON.stringify(payload);
    const sig = hmacSha256Hex(secret, body);
    const ingest = await fetch(`${baseUrl}/v1/webhooks/email-bridge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qev-signature": `sha256=${sig}`,
      },
      body,
    });
    expect(ingest.status).toBe(202);
  });

  // Audit F-15: GET /v1/health served the gateway's entire internal
  // posture unauthenticated - every preflight check and its detail
  // strings, the connector inventory, the org signing key_id, queue
  // depths, case-log state and the human-confirmation policy list.
  describe("health endpoint disclosure", () => {
    const SENSITIVE = [
      "preflight",
      "connectors",
      "signing",
      "queue",
      "case_log",
      "requires_human_confirmation",
      "cases",
      "packages",
    ];

    it("serves liveness without auth and leaks none of the internals", async () => {
      const res = await fetch(`${baseUrl}/v1/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;

      // Useful enough to route on...
      expect(body.product).toBe("qev-gateway");
      expect(typeof body.version).toBe("string");
      expect(typeof body.healthy).toBe("boolean");

      // ...and nothing that describes how this gateway is configured.
      for (const key of SENSITIVE) {
        expect(body, `public health must not expose "${key}"`).not.toHaveProperty(key);
      }
      // Belt and braces: the signing key id must not appear anywhere in
      // the serialised payload, under any key.
      expect(JSON.stringify(body)).not.toMatch(/org_[A-Za-z0-9]/);
    });

    it("returns the full report with a valid token", async () => {
      const res = await fetch(`${baseUrl}/v1/health`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      for (const key of SENSITIVE) {
        expect(body, `authenticated health should expose "${key}"`).toHaveProperty(key);
      }
    });

    it("falls back to the public view on a wrong token rather than erroring", async () => {
      const res = await fetch(`${baseUrl}/v1/health`, {
        headers: { authorization: "Bearer not-the-token" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("preflight");
    });

    it("rejects /v1/preflight without a token", async () => {
      const res = await fetch(`${baseUrl}/v1/preflight`);
      expect(res.status).toBe(401);
    });

    it("rejects /v1/preflight with a wrong token", async () => {
      const res = await fetch(`${baseUrl}/v1/preflight`, {
        headers: { authorization: "Bearer not-the-token" },
      });
      expect(res.status).toBe(401);
    });

    it("reports one version across /healthz and /v1/health", async () => {
      const [liveness, health] = await Promise.all([
        fetch(`${baseUrl}/healthz`).then((r) => r.json() as Promise<Record<string, unknown>>),
        fetch(`${baseUrl}/v1/health`).then((r) => r.json() as Promise<Record<string, unknown>>),
      ]);
      // These disagreed before: "0.2.0-pilot" vs "0.3.0-seamless-p0" on
      // the same running process.
      expect(liveness.version).toBe(health.version);
    });
  });
});

// A gateway still running the shipped default token must be treated as
// unconfigured, not as authorised - otherwise the "protection" is a
// published constant. This needs its own server instance.
describe("detailed health fails closed when the token is the shipped default", () => {
  let baseUrl = "";
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qev-gw-default-"));
    const config = {
      ...loadConfig({
        QEV_DATA_DIR: dir,
        QEV_STORAGE_DIR: path.join(dir, "packages"),
        QEV_WEBHOOK_SECRET: "test-secret",
        // deliberately left at the shipped default
        QEV_INGEST_TOKEN: "dev-ingest-token-change-me",
        QEV_PACKAGE_PASSPHRASE: "test-passphrase",
        QEV_TENANT_ID: "test-tenant",
        QEV_SHADOW_MODE: "true",
      }),
      host: "127.0.0.1",
      port: 0,
    };
    const store = new GatewayStore(config.storageDir, config.eventsDir);
    const queue = new DurableQueue(config.queueDir);
    const caseLog = new CaseLog(config.caseLogDir);
    const settingsStore = new SettingsStore(config.settingsDir);
    const signingKeys = new SigningKeyStore(path.join(dir, "signing"));
    await store.init();
    await queue.init();
    await caseLog.init();
    await settingsStore.init();
    await signingKeys.init();
    const gw = createGateway(config, store, queue, caseLog, settingsStore, signingKeys);
    server = gw.server;
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("refuses the detailed report even when the default token is presented", async () => {
    const res = await fetch(`${baseUrl}/v1/health`, {
      headers: { authorization: "Bearer dev-ingest-token-change-me" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("preflight");
    expect(body).not.toHaveProperty("signing");
  });

  it("refuses /v1/preflight with the default token", async () => {
    const res = await fetch(`${baseUrl}/v1/preflight`, {
      headers: { authorization: "Bearer dev-ingest-token-change-me" },
    });
    expect(res.status).toBe(401);
  });
});
