import { mkdir, writeFile, readFile, access, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import type { QevEventV1 } from "@imagineqira/qev-event-schema";
import type { PolicyDecision } from "@imagineqira/qev-policy-engine";
import type { QevPackageFile } from "@imagineqira/qev-core";

export interface StoredEvent {
  event: QevEventV1;
  decision: PolicyDecision;
}

export interface CaseSealRecord {
  flow_id: string;
  case_id: string;
  primary_package_id: string;
  supplemental_package_ids: string[];
  /** Event IDs included in the latest primary or last seal set */
  sealed_event_ids: string[];
  updated_at: string;
}

export class GatewayStore {
  private eventsByCase = new Map<string, StoredEvent[]>();
  private eventsById = new Map<string, StoredEvent>();
  private packages = new Map<string, QevPackageFile>();
  private sealsByCase = new Map<string, CaseSealRecord>();

  constructor(
    private storageDir: string,
    private eventsDir: string,
  ) {}

  async init(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
    await mkdir(this.eventsDir, { recursive: true });
    await mkdir(path.join(this.storageDir, "backup"), { recursive: true });
    await mkdir(path.join(this.storageDir, "artifacts"), { recursive: true });
    await mkdir(path.join(this.storageDir, "certificates"), { recursive: true });
    await this.loadPersistedEvents();
    await this.loadSeals();
  }

  private sealsPath(): string {
    return path.join(this.storageDir, "case-seals.json");
  }

  private async loadSeals(): Promise<void> {
    try {
      const raw = await readFile(this.sealsPath(), "utf8");
      const obj = JSON.parse(raw) as Record<string, CaseSealRecord>;
      this.sealsByCase = new Map(Object.entries(obj));
    } catch {
      this.sealsByCase = new Map();
    }
  }

  private async saveSeals(): Promise<void> {
    await writeFile(
      this.sealsPath(),
      JSON.stringify(Object.fromEntries(this.sealsByCase), null, 2),
      "utf8",
    );
  }

  getSealRecord(flowId: string, caseId: string): CaseSealRecord | undefined {
    return this.sealsByCase.get(this.caseKey(flowId, caseId));
  }

  async recordSeal(rec: CaseSealRecord): Promise<void> {
    this.sealsByCase.set(this.caseKey(rec.flow_id, rec.case_id), rec);
    await this.saveSeals();
  }

  unsealedEvents(flowId: string, caseId: string): StoredEvent[] {
    const rows = this.getCase(flowId, caseId);
    const seal = this.getSealRecord(flowId, caseId);
    if (!seal) return rows;
    const sealed = new Set(seal.sealed_event_ids);
    return rows.filter((r) => !sealed.has(r.event.event_id));
  }

  async saveCertificate(id: string, cert: unknown): Promise<string> {
    const p = path.join(this.storageDir, "certificates", `${id}.json`);
    await writeFile(p, JSON.stringify(cert, null, 2), "utf8");
    return p;
  }

  async loadCertificate(id: string): Promise<unknown | null> {
    try {
      const p = path.join(this.storageDir, "certificates", `${id}.json`);
      return JSON.parse(await readFile(p, "utf8"));
    } catch {
      return null;
    }
  }

  async listCertificates(): Promise<string[]> {
    try {
      const files = await readdir(path.join(this.storageDir, "certificates"));
      return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }

  private async loadPersistedEvents(): Promise<void> {
    try {
      const files = await readdir(this.eventsDir);
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        const raw = await readFile(path.join(this.eventsDir, f), "utf8");
        const row = JSON.parse(raw) as StoredEvent;
        if (!this.eventsById.has(row.event.event_id)) {
          this.eventsById.set(row.event.event_id, row);
          const key = this.caseKey(row.event.flow_id, row.event.case_id);
          const list = this.eventsByCase.get(key) ?? [];
          list.push(row);
          this.eventsByCase.set(key, list);
        }
      }
    } catch {
      // empty
    }
  }

  caseKey(flowId: string, caseId: string): string {
    return `${flowId}::${caseId}`;
  }

  hasEvent(eventId: string): boolean {
    return this.eventsById.has(eventId);
  }

  async putEvent(
    event: QevEventV1,
    decision: PolicyDecision,
  ): Promise<{ duplicate: boolean }> {
    if (this.eventsById.has(event.event_id)) {
      return { duplicate: true };
    }
    const row: StoredEvent = { event, decision };
    this.eventsById.set(event.event_id, row);
    const key = this.caseKey(event.flow_id, event.case_id);
    const list = this.eventsByCase.get(key) ?? [];
    list.push(row);
    this.eventsByCase.set(key, list);
    await writeFile(
      path.join(this.eventsDir, `${event.event_id}.json`),
      JSON.stringify(row, null, 2),
      "utf8",
    );
    return { duplicate: false };
  }

  getCase(flowId: string, caseId: string): StoredEvent[] {
    return this.eventsByCase.get(this.caseKey(flowId, caseId)) ?? [];
  }

  listCases(flowId?: string): Array<{
    flow_id: string;
    case_id: string;
    event_count: number;
    last_action?: string;
    last_at?: string;
  }> {
    const out: Array<{
      flow_id: string;
      case_id: string;
      event_count: number;
      last_action?: string;
      last_at?: string;
    }> = [];
    for (const [key, rows] of this.eventsByCase) {
      const [flow_id, case_id] = key.split("::");
      if (flowId && flow_id !== flowId) continue;
      const last = rows[rows.length - 1];
      out.push({
        flow_id: flow_id!,
        case_id: case_id!,
        event_count: rows.length,
        last_action: last?.event.action,
        last_at: last?.event.occurred_at,
      });
    }
    return out.sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));
  }

  getEvent(eventId: string): StoredEvent | undefined {
    return this.eventsById.get(eventId);
  }

  async savePackage(pkg: QevPackageFile): Promise<string> {
    this.packages.set(pkg.package_id, pkg);
    const filePath = path.join(this.storageDir, `${pkg.package_id}.qevpkg.json`);
    await writeFile(filePath, JSON.stringify(pkg, null, 2), "utf8");
    // Package backup copy
    await copyFile(
      filePath,
      path.join(this.storageDir, "backup", `${pkg.package_id}.qevpkg.json`),
    );
    return filePath;
  }

  async loadPackage(packageId: string): Promise<QevPackageFile | null> {
    const mem = this.packages.get(packageId);
    if (mem) return mem;
    const filePath = path.join(this.storageDir, `${packageId}.qevpkg.json`);
    try {
      await access(filePath);
      const raw = await readFile(filePath, "utf8");
      const pkg = JSON.parse(raw) as QevPackageFile;
      this.packages.set(packageId, pkg);
      return pkg;
    } catch {
      return null;
    }
  }

  async listPackages(): Promise<
    Array<{
      package_id: string;
      case_id: string;
      flow_id: string;
      created_at: string;
      public_meta: QevPackageFile["public_meta"];
    }>
  > {
    const files = await readdir(this.storageDir);
    const out = [];
    for (const f of files.filter((x) => x.endsWith(".qevpkg.json"))) {
      const raw = await readFile(path.join(this.storageDir, f), "utf8");
      const pkg = JSON.parse(raw) as QevPackageFile;
      this.packages.set(pkg.package_id, pkg);
      out.push({
        package_id: pkg.package_id,
        case_id: pkg.case_id,
        flow_id: pkg.flow_id,
        created_at: pkg.created_at,
        public_meta: pkg.public_meta,
      });
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  packagePath(packageId: string): string {
    return path.join(this.storageDir, `${packageId}.qevpkg.json`);
  }

  artifactsDir(): string {
    return path.join(this.storageDir, "artifacts");
  }
}
