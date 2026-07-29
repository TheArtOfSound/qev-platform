/**
 * Durable disk queue (Stripe/Temporal patterns, file-backed for pilot).
 * - Append-only job files
 * - Idempotency index
 * - Dead-letter on permanent failure
 * - Retry with backoff metadata
 */
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { newId, sha256Hex } from "@imagineqira/qev-shared";

export type QueueJobStatus =
  | "pending"
  | "processing"
  | "done"
  | "dead"
  | "duplicate";

export interface QueueJob {
  id: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  max_attempts: number;
  status: QueueJobStatus;
  kind: string;
  payload: unknown;
  last_error?: string;
  next_attempt_at?: string;
}

export class DurableQueue {
  private idempo = new Map<string, string>(); // key -> job id
  private ready = false;

  constructor(private rootDir: string) {}

  private dir(...parts: string[]): string {
    return path.join(this.rootDir, ...parts);
  }

  async init(): Promise<void> {
    await mkdir(this.dir("pending"), { recursive: true });
    await mkdir(this.dir("processing"), { recursive: true });
    await mkdir(this.dir("done"), { recursive: true });
    await mkdir(this.dir("dead"), { recursive: true });
    await mkdir(this.dir("meta"), { recursive: true });
    await this.loadIdempo();
    // Recover interrupted processing → pending
    for (const name of await readdir(this.dir("processing"))) {
      if (!name.endsWith(".json")) continue;
      await rename(this.dir("processing", name), this.dir("pending", name));
    }
    this.ready = true;
  }

  private async loadIdempo(): Promise<void> {
    const p = this.dir("meta", "idempotency.json");
    try {
      const raw = await readFile(p, "utf8");
      const obj = JSON.parse(raw) as Record<string, string>;
      this.idempo = new Map(Object.entries(obj));
    } catch {
      this.idempo = new Map();
    }
  }

  private async saveIdempo(): Promise<void> {
    const obj = Object.fromEntries(this.idempo);
    await writeFile(
      this.dir("meta", "idempotency.json"),
      JSON.stringify(obj, null, 2),
      "utf8",
    );
  }

  async enqueue(opts: {
    kind: string;
    payload: unknown;
    idempotency_key: string;
    max_attempts?: number;
  }): Promise<{ job: QueueJob; duplicate: boolean }> {
    if (!this.ready) await this.init();
    const existing = this.idempo.get(opts.idempotency_key);
    if (existing) {
      const job = await this.readJobAnywhere(existing);
      if (job) {
        return {
          job: { ...job, status: "duplicate" },
          duplicate: true,
        };
      }
    }

    const now = new Date().toISOString();
    const job: QueueJob = {
      id: newId("job"),
      idempotency_key: opts.idempotency_key,
      created_at: now,
      updated_at: now,
      attempts: 0,
      max_attempts: opts.max_attempts ?? 5,
      status: "pending",
      kind: opts.kind,
      payload: opts.payload,
    };
    this.idempo.set(opts.idempotency_key, job.id);
    await this.saveIdempo();
    await writeFile(
      this.dir("pending", `${job.id}.json`),
      JSON.stringify(job, null, 2),
      "utf8",
    );
    return { job, duplicate: false };
  }

  async claimNext(): Promise<QueueJob | null> {
    if (!this.ready) await this.init();
    const names = (await readdir(this.dir("pending")))
      .filter((n) => n.endsWith(".json"))
      .sort();
    for (const name of names) {
      const raw = await readFile(this.dir("pending", name), "utf8");
      const job = JSON.parse(raw) as QueueJob;
      if (job.next_attempt_at && job.next_attempt_at > new Date().toISOString()) {
        continue;
      }
      job.status = "processing";
      job.attempts += 1;
      job.updated_at = new Date().toISOString();
      await writeFile(
        this.dir("processing", name),
        JSON.stringify(job, null, 2),
        "utf8",
      );
      await unlink(this.dir("pending", name)).catch(() => undefined);
      return job;
    }
    return null;
  }

  async complete(jobId: string): Promise<void> {
    const job = await this.readFrom("processing", jobId);
    if (!job) return;
    job.status = "done";
    job.updated_at = new Date().toISOString();
    await writeFile(
      this.dir("done", `${jobId}.json`),
      JSON.stringify(job, null, 2),
      "utf8",
    );
    await unlink(this.dir("processing", `${jobId}.json`)).catch(() => undefined);
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.readFrom("processing", jobId);
    if (!job) return;
    job.last_error = error.slice(0, 2000);
    job.updated_at = new Date().toISOString();
    if (job.attempts >= job.max_attempts) {
      job.status = "dead";
      await writeFile(
        this.dir("dead", `${jobId}.json`),
        JSON.stringify(job, null, 2),
        "utf8",
      );
      await unlink(this.dir("processing", `${jobId}.json`)).catch(() => undefined);
      return;
    }
    // Backoff: 2^(attempts-1) seconds (capped). attempts already incremented on claim.
    const delaySec = Math.min(300, Math.max(0, 2 ** (job.attempts - 1) - 1));
    job.status = "pending";
    job.next_attempt_at =
      delaySec === 0
        ? undefined
        : new Date(Date.now() + delaySec * 1000).toISOString();
    await writeFile(
      this.dir("pending", `${jobId}.json`),
      JSON.stringify(job, null, 2),
      "utf8",
    );
    await unlink(this.dir("processing", `${jobId}.json`)).catch(() => undefined);
  }

  async stats(): Promise<{
    pending: number;
    processing: number;
    done: number;
    dead: number;
  }> {
    if (!this.ready) await this.init();
    const count = async (d: string) =>
      (await readdir(this.dir(d))).filter((n) => n.endsWith(".json")).length;
    return {
      pending: await count("pending"),
      processing: await count("processing"),
      done: await count("done"),
      dead: await count("dead"),
    };
  }

  async listDead(): Promise<QueueJob[]> {
    const names = await readdir(this.dir("dead"));
    const out: QueueJob[] = [];
    for (const n of names.filter((x) => x.endsWith(".json"))) {
      const raw = await readFile(this.dir("dead", n), "utf8");
      out.push(JSON.parse(raw) as QueueJob);
    }
    return out;
  }

  /** Manual replay from DLQ → pending */
  async replayDead(jobId: string): Promise<boolean> {
    const job = await this.readFrom("dead", jobId);
    if (!job) return false;
    job.status = "pending";
    job.attempts = 0;
    job.last_error = undefined;
    job.next_attempt_at = undefined;
    job.updated_at = new Date().toISOString();
    await writeFile(
      this.dir("pending", `${jobId}.json`),
      JSON.stringify(job, null, 2),
      "utf8",
    );
    await unlink(this.dir("dead", `${jobId}.json`));
    return true;
  }

  private async readFrom(
    folder: "pending" | "processing" | "done" | "dead",
    jobId: string,
  ): Promise<QueueJob | null> {
    try {
      const raw = await readFile(this.dir(folder, `${jobId}.json`), "utf8");
      return JSON.parse(raw) as QueueJob;
    } catch {
      return null;
    }
  }

  private async readJobAnywhere(jobId: string): Promise<QueueJob | null> {
    for (const f of ["pending", "processing", "done", "dead"] as const) {
      const j = await this.readFrom(f, jobId);
      if (j) return j;
    }
    return null;
  }

  /** Content fingerprint for queue integrity checks */
  static payloadFingerprint(payload: unknown): string {
    return sha256Hex(JSON.stringify(payload));
  }
}
