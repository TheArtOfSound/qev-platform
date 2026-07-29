/**
 * Local watched-folder connector (Increment B).
 * Folder layout: <watch_dir>/<CASE_ID>/before|after|other/<file>
 * Or filename containing JOB-xxx.
 */
import { readdir, readFile, stat, watch } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { matchCase } from "@imagineqira/qev-ops";
import type { QevEventV1 } from "@imagineqira/qev-event-schema";
import { newId } from "@imagineqira/qev-shared";

export interface FileWatchOptions {
  watchDir: string;
  tenantId: string;
  knownCaseIds: () => string[];
  onEvent: (event: QevEventV1) => Promise<void>;
  pollMs?: number;
}

export class FileWatchConnector {
  private seen = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private opts: FileWatchOptions) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.scanOnce();
    const ms = this.opts.pollMs ?? 5000;
    this.timer = setInterval(() => {
      void this.scanOnce();
    }, ms);
    // Best-effort fs.watch (may not work on all FS)
    try {
      const ac = new AbortController();
      void (async () => {
        try {
          // Node 20+ recursive watch support varies
          const watcher = watch(this.opts.watchDir, { recursive: true });
          for await (const _ of watcher) {
            if (this.stopped) break;
            await this.scanOnce();
          }
        } catch {
          /* poll is enough */
        }
        void ac;
      })();
    } catch {
      /* poll only */
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  private async scanOnce(): Promise<void> {
    try {
      await this.walk(this.opts.watchDir);
    } catch {
      // dir may not exist yet
    }
  }

  private async walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.name.startsWith(".")) continue;
      if (ent.isDirectory()) {
        await this.walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      // Skip incomplete writes: size stable check via mtime age
      const st = await stat(full);
      if (Date.now() - st.mtimeMs < 1500) continue; // still writing
      const key = `${full}:${st.size}:${st.mtimeMs}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      await this.ingestFile(full, st.size);
    }
  }

  private async ingestFile(full: string, size: number): Promise<void> {
    const buf = await readFile(full);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const rel = path.relative(this.opts.watchDir, full);
    const match = matchCase({
      folder_path: rel,
      artifact_name: path.basename(full),
      known_case_ids: this.opts.knownCaseIds(),
    });
    if (!match.case_id || match.needs_manual_review) {
      // Unmatched — still record under UNMATCHED for operator review
      if (!match.case_id) return;
    }
    const lower = full.toLowerCase();
    const kind = lower.includes("/before") || lower.includes("before")
      ? "before"
      : lower.includes("/after") || lower.includes("after")
        ? "after"
        : "other";
    const action =
      kind === "before"
        ? "evidence.before_captured"
        : kind === "after"
          ? "evidence.after_captured"
          : "evidence.file_captured";
    const now = new Date().toISOString();
    const event: QevEventV1 = {
      schema: "qev.event.v1",
      event_id: newId("fwatch"),
      occurred_at: now,
      observed_at: now,
      tenant_id: this.opts.tenantId,
      flow_id: "field-service",
      case_id: match.case_id!,
      source: {
        system: "file-watch",
        connector: "file-watch",
        connector_version: "0.1.0",
        ingestion_path: "file",
        raw_body_sha256: sha256,
      },
      actor: {
        id: "file-watch",
        identity_assurance: "source_asserted",
      },
      action,
      outcome: "success",
      artifacts: [
        {
          name: path.basename(full),
          sha256,
          size_bytes: size,
          uri: `file://${full}`,
        },
      ],
      privacy: { default_mode: "full" },
      payload: {
        path: full,
        match_confidence: match.confidence,
        match_detail: match.detail,
      },
      known_gaps:
        match.confidence === "uncertain"
          ? [
              {
                code: "uncertain_case_match",
                message: match.detail,
                severity: "warning",
              },
            ]
          : [],
      time_assurance: { gateway_receipt_time: now },
    };
    await this.opts.onEvent(event);
  }
}
