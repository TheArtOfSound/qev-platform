/**
 * Append-only case event log with chained digests (CloudTrail-inspired).
 * Detects missing/tampered log intervals — not only single-file integrity.
 */
import { mkdir, appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex, canonicalJSON } from "@imagineqira/qev-shared";

export interface CaseLogEntry {
  seq: number;
  at: string;
  case_id: string;
  flow_id: string;
  kind: string;
  event_id?: string;
  package_id?: string;
  summary: string;
  prev_digest: string;
  digest: string;
}

export class CaseLog {
  private seq = 0;
  private lastDigest =
    "0000000000000000000000000000000000000000000000000000000000000000";
  private ready = false;

  constructor(private rootDir: string) {}

  private logPath(): string {
    return path.join(this.rootDir, "case-log.jsonl");
  }

  private metaPath(): string {
    return path.join(this.rootDir, "case-log.meta.json");
  }

  async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    try {
      const meta = JSON.parse(await readFile(this.metaPath(), "utf8")) as {
        seq: number;
        last_digest: string;
      };
      this.seq = meta.seq;
      this.lastDigest = meta.last_digest;
    } catch {
      await writeFile(
        this.metaPath(),
        JSON.stringify({ seq: 0, last_digest: this.lastDigest }, null, 2),
      );
    }
    this.ready = true;
  }

  async append(opts: {
    case_id: string;
    flow_id: string;
    kind: string;
    event_id?: string;
    package_id?: string;
    summary: string;
  }): Promise<CaseLogEntry> {
    if (!this.ready) await this.init();
    this.seq += 1;
    const at = new Date().toISOString();
    const body = {
      seq: this.seq,
      at,
      case_id: opts.case_id,
      flow_id: opts.flow_id,
      kind: opts.kind,
      event_id: opts.event_id,
      package_id: opts.package_id,
      summary: opts.summary,
      prev_digest: this.lastDigest,
    };
    const digest = sha256Hex(canonicalJSON(body));
    const entry: CaseLogEntry = { ...body, digest };
    await appendFile(this.logPath(), JSON.stringify(entry) + "\n", "utf8");
    this.lastDigest = digest;
    await writeFile(
      this.metaPath(),
      JSON.stringify({ seq: this.seq, last_digest: this.lastDigest }, null, 2),
    );
    return entry;
  }

  async verifyChain(): Promise<{
    ok: boolean;
    entries: number;
    failures: string[];
  }> {
    if (!this.ready) await this.init();
    const failures: string[] = [];
    let raw = "";
    try {
      raw = await readFile(this.logPath(), "utf8");
    } catch {
      return { ok: true, entries: 0, failures: [] };
    }
    const lines = raw.split("\n").filter(Boolean);
    let prev =
      "0000000000000000000000000000000000000000000000000000000000000000";
    let expectedSeq = 0;
    for (const line of lines) {
      const e = JSON.parse(line) as CaseLogEntry;
      expectedSeq += 1;
      if (e.seq !== expectedSeq) {
        failures.push(`seq gap: expected ${expectedSeq}, got ${e.seq}`);
      }
      if (e.prev_digest !== prev) {
        failures.push(`broken chain at seq ${e.seq}`);
      }
      const body = {
        seq: e.seq,
        at: e.at,
        case_id: e.case_id,
        flow_id: e.flow_id,
        kind: e.kind,
        event_id: e.event_id,
        package_id: e.package_id,
        summary: e.summary,
        prev_digest: e.prev_digest,
      };
      const dig = sha256Hex(canonicalJSON(body));
      if (dig !== e.digest) {
        failures.push(`digest mismatch at seq ${e.seq}`);
      }
      prev = e.digest;
    }
    return { ok: failures.length === 0, entries: lines.length, failures };
  }

  async listForCase(caseId: string): Promise<CaseLogEntry[]> {
    if (!this.ready) await this.init();
    try {
      const raw = await readFile(this.logPath(), "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as CaseLogEntry)
        .filter((e) => e.case_id === caseId);
    } catch {
      return [];
    }
  }
}
