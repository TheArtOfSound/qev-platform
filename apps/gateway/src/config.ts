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
  requireAuth: boolean;
  deploymentKind: "customer_controlled" | "operator_evaluation";
  pathPrefix: string;
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
  if (env.NODE_ENV === "production") {
    for (const name of ["QEV_WEBHOOK_SECRET", "QEV_INGEST_TOKEN", "QEV_PACKAGE_PASSPHRASE"]) {
      if (!env[name] || env[name]!.length < 32 || /change-me|^dev-/.test(env[name]!)) {
        throw new Error(`Production requires an explicit strong ${name}`);
      }
    }
    if (!env.QEV_TENANT_ID || env.QEV_TENANT_ID === "local-dev") throw new Error("Production requires QEV_TENANT_ID");
  }
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
    requireAuth: env.NODE_ENV === "production" || env.QEV_REQUIRE_AUTH === "true",
    deploymentKind: env.QEV_DEPLOYMENT_KIND === "operator_evaluation" ? "operator_evaluation" : "customer_controlled",
    pathPrefix: env.QEV_PATH_PREFIX === "/platform" ? "/platform" : "",
  };
}
