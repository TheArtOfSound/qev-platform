import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PrivacyMode =
  | "full"
  | "redacted"
  | "hash_only"
  | "reference_only"
  | "drop";

export interface PilotSettings {
  flow_id: "field-service";
  flow_title: string;
  /** record | shadow | gate — "live" accepted as alias for shadow */
  mode: "record" | "shadow" | "live" | "gate";
  gate_confirmed?: boolean;
  storage_dir_label: string;
  enabled: boolean;
  unlock: {
    passphrase_enabled: boolean;
    note: string;
  };
  privacy: {
    default_mode: PrivacyMode;
    field_modes: Record<string, PrivacyMode>;
  };
  connectors: {
    job_portal: { enabled: boolean; status: "healthy" | "disabled" | "error" };
    photo_file: {
      enabled: boolean;
      status: "healthy" | "disabled" | "error";
      watch_dir?: string;
    };
    generic_webhook: {
      enabled: boolean;
      status: "healthy" | "disabled" | "error";
    };
  };
  recipients: string[];
  setup_completed: boolean;
  /** Auto-seal when required evidence is complete (shadow/record). */
  auto_seal: boolean;
  /** Create supplemental packages for late events (never rewrite primary). */
  supplemental_packages: boolean;
  updated_at: string;
}

export function defaultSettings(): PilotSettings {
  return {
    flow_id: "field-service",
    flow_title: "Field Service Job Evidence",
    mode: "shadow",
    storage_dir_label: "Local packages folder (customer-controlled)",
    enabled: false,
    unlock: {
      passphrase_enabled: true,
      note: "Pilot unlock: package passphrase. KMS/device slots planned later.",
    },
    privacy: {
      default_mode: "full",
      field_modes: {
        customer_phone: "redacted",
        customer_email: "redacted",
        card_last4: "hash_only",
        internal_notes: "drop",
      },
    },
    connectors: {
      job_portal: { enabled: true, status: "healthy" },
      photo_file: { enabled: true, status: "healthy" },
      generic_webhook: { enabled: true, status: "healthy" },
    },
    recipients: ["operator", "auditor"],
    setup_completed: false,
    auto_seal: true,
    supplemental_packages: true,
    updated_at: new Date().toISOString(),
  };
}

export class SettingsStore {
  constructor(private dataDir: string) {}

  private file(): string {
    return path.join(this.dataDir, "settings.json");
  }

  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  async load(): Promise<PilotSettings> {
    try {
      const raw = await readFile(this.file(), "utf8");
      return { ...defaultSettings(), ...JSON.parse(raw) } as PilotSettings;
    } catch {
      return defaultSettings();
    }
  }

  async save(s: PilotSettings): Promise<PilotSettings> {
    const next = { ...s, updated_at: new Date().toISOString() };
    await writeFile(this.file(), JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}
