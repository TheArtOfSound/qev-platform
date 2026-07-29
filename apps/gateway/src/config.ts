import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface GatewayConfig {
  host: string;
  port: number;
  dataDir: string;
  storageDir: string;
  eventsDir: string;
  queueDir: string;
  caseLogDir: string;
  settingsDir: string;
  adminDir: string;
  signingDir: string;
  webhookSecret: string;
  ingestToken: string;
  packagePassphrase: string;
  tenantId: string;
  shadowMode: boolean;
}

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/gateway/src -> repo root
  return path.resolve(here, "../../..");
}

function defaultDataDir(): string {
  const root = repoRootFromHere();
  if (existsSync(path.join(root, "pnpm-workspace.yaml"))) {
    return path.join(root, "data");
  }
  return path.resolve("./data");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const dataDir = path.resolve(env.QEV_DATA_DIR ?? defaultDataDir());
  const root = repoRootFromHere();
  const adminDir = path.join(root, "apps/admin/public");
  return {
    host: env.QEV_HOST ?? "127.0.0.1",
    port: Number(env.QEV_PORT ?? "7443"),
    dataDir,
    storageDir: path.resolve(env.QEV_STORAGE_DIR ?? path.join(dataDir, "packages")),
    eventsDir: path.join(dataDir, "events"),
    queueDir: path.join(dataDir, "queue"),
    caseLogDir: path.join(dataDir, "case-log"),
    settingsDir: path.join(dataDir, "config"),
    adminDir,
    signingDir: path.join(dataDir, "signing"),
    webhookSecret: env.QEV_WEBHOOK_SECRET ?? "dev-webhook-secret-change-me",
    ingestToken: env.QEV_INGEST_TOKEN ?? "dev-ingest-token-change-me",
    packagePassphrase:
      env.QEV_PACKAGE_PASSPHRASE ?? "change-me-for-local-dev-only",
    tenantId: env.QEV_TENANT_ID ?? "local-dev",
    shadowMode: (env.QEV_SHADOW_MODE ?? "true") !== "false",
  };
}
