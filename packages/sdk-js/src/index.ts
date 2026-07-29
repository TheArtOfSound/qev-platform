import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface QEVClientOptions {
  endpoint: string;
  token: string;
  tenantId?: string;
  fetchImpl?: typeof fetch;
}

export interface CaptureInput {
  flow: string;
  caseId: string;
  type: string;
  actor: { id: string; display_name?: string };
  outcome?: "success" | "failure" | "pending" | "blocked" | "unknown";
  payload?: Record<string, unknown>;
  artifact?: { name: string; sha256: string; media_type?: string; size_bytes?: number };
  artifacts?: Array<{
    name: string;
    sha256: string;
    media_type?: string;
    size_bytes?: number;
  }>;
  occurred_at?: string;
}

export class QEV {
  private endpoint: string;
  private token: string;
  private tenantId?: string;
  private fetchImpl: typeof fetch;

  constructor(opts: QEVClientOptions) {
    this.endpoint = opts.endpoint.replace(/\/$/, "");
    this.token = opts.token;
    this.tenantId = opts.tenantId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** Hash a local file for artifact fingerprinting. */
  async file(path: string): Promise<{
    name: string;
    sha256: string;
    size_bytes: number;
  }> {
    const buf = await readFile(path);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const name = path.split(/[/\\]/).pop() ?? path;
    return { name, sha256, size_bytes: buf.byteLength };
  }

  async capture(input: CaptureInput): Promise<{
    event_id: string;
    status: string;
    policy_effect?: string;
    package_id?: string;
  }> {
    const now = new Date().toISOString();
    const artifacts = [
      ...(input.artifacts ?? []),
      ...(input.artifact ? [input.artifact] : []),
    ];
    const event = {
      schema: "qev.event.v1",
      event_id: `sdk_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      occurred_at: input.occurred_at ?? now,
      observed_at: now,
      tenant_id: this.tenantId ?? "unknown",
      flow_id: input.flow,
      case_id: input.caseId,
      source: {
        system: "customer-app",
        connector: "sdk-js",
        connector_version: "0.1.0",
        ingestion_path: "sdk",
      },
      actor: {
        id: input.actor.id,
        display_name: input.actor.display_name,
        identity_assurance: "source_asserted",
      },
      action: input.type,
      outcome: input.outcome ?? "success",
      artifacts,
      privacy: { default_mode: "full" },
      payload: input.payload ?? {},
      known_gaps: [],
    };

    const res = await this.fetchImpl(`${this.endpoint}/v1/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ event }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QEV capture failed (${res.status}): ${text}`);
    }
    return (await res.json()) as {
      event_id: string;
      status: string;
      policy_effect?: string;
      package_id?: string;
    };
  }

  async complete(opts: {
    flow: string;
    caseId: string;
    passphrase?: string;
  }): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(
      `${this.endpoint}/v1/flows/${encodeURIComponent(opts.flow)}/complete`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          case_id: opts.caseId,
          passphrase: opts.passphrase,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QEV complete failed (${res.status}): ${text}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  async workflow<T>(
    ctx: { flow: string; caseId: string; actor: { id: string } },
    fn: (run: WorkflowRun) => Promise<T>,
  ): Promise<T> {
    const run = new WorkflowRun(this, ctx);
    return fn(run);
  }
}

export class WorkflowRun {
  constructor(
    private client: QEV,
    private ctx: { flow: string; caseId: string; actor: { id: string } },
  ) {}

  async record(
    type: string,
    payload: Record<string, unknown> = {},
    extra: Partial<CaptureInput> = {},
  ) {
    return this.client.capture({
      flow: this.ctx.flow,
      caseId: this.ctx.caseId,
      type,
      actor: this.ctx.actor,
      payload,
      ...extra,
    });
  }

  async complete(passphrase?: string) {
    return this.client.complete({
      flow: this.ctx.flow,
      caseId: this.ctx.caseId,
      passphrase,
    });
  }
}
