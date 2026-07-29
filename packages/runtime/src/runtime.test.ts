import { describe, expect, it, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DurableQueue } from "./queue.js";
import { CaseLog } from "./case-log.js";
import { makeIdempotencyKey } from "./idempotency.js";

describe("durable queue", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "qev-q-"));
  });

  it("dedupes by idempotency key", async () => {
    const q = new DurableQueue(dir);
    await q.init();
    const a = await q.enqueue({
      kind: "ingest",
      payload: { x: 1 },
      idempotency_key: "k1",
    });
    const b = await q.enqueue({
      kind: "ingest",
      payload: { x: 2 },
      idempotency_key: "k1",
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.job.id).toBe(a.job.id);
  });

  it("retries then dead-letters", async () => {
    const q = new DurableQueue(dir);
    await q.init();
    const { job } = await q.enqueue({
      kind: "ingest",
      payload: {},
      idempotency_key: "k2",
      max_attempts: 2,
    });
    const c1 = await q.claimNext();
    expect(c1?.id).toBe(job.id);
    await q.fail(job.id, "boom");
    const c2 = await q.claimNext();
    expect(c2?.id).toBe(job.id);
    await q.fail(job.id, "boom again");
    const stats = await q.stats();
    expect(stats.dead).toBe(1);
    const ok = await q.replayDead(job.id);
    expect(ok).toBe(true);
    expect((await q.stats()).pending).toBe(1);
  });
});

describe("case log chain", () => {
  it("verifies append-only digests", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qev-cl-"));
    const log = new CaseLog(dir);
    await log.init();
    await log.append({
      case_id: "J1",
      flow_id: "field-service",
      kind: "event.accepted",
      summary: "job created",
    });
    await log.append({
      case_id: "J1",
      flow_id: "field-service",
      kind: "package.sealed",
      summary: "sealed",
    });
    const v = await log.verifyChain();
    expect(v.ok).toBe(true);
    expect(v.entries).toBe(2);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("idempotency key", () => {
  it("prefers provider event id", () => {
    expect(
      makeIdempotencyKey({
        tenantId: "t",
        connector: "c",
        providerEventId: "p1",
      }),
    ).toBe("prov:t:c:p1");
  });
});
