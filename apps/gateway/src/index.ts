import path from "node:path";
import { loadConfig } from "./config.js";
import { GatewayStore } from "./store.js";
import { createGateway } from "./server.js";
import { DurableQueue, CaseLog } from "@imagineqira/qev-runtime";
import { SettingsStore } from "./settings.js";
import { SigningKeyStore } from "./keys.js";

const config = loadConfig();
const store = new GatewayStore(config.storageDir, config.eventsDir);
const queue = new DurableQueue(config.queueDir);
const caseLog = new CaseLog(config.caseLogDir);
const settingsStore = new SettingsStore(config.settingsDir);
const signingKeys = new SigningKeyStore(path.join(config.dataDir, "signing"));

await store.init();
await queue.init();
await caseLog.init();
await settingsStore.init();
await signingKeys.init();

const { server, ingestEvent } = createGateway(
  config,
  store,
  queue,
  caseLog,
  settingsStore,
  signingKeys,
);

// Optional watched-folder connector
const settings = await settingsStore.load();
const watchDir = settings.connectors.photo_file.watch_dir;
if (watchDir && settings.connectors.photo_file.enabled) {
  const { FileWatchConnector } = await import("./file-watch.js");
  const fw = new FileWatchConnector({
    watchDir,
    tenantId: config.tenantId,
    knownCaseIds: () => store.listCases().map((c) => c.case_id),
    onEvent: async (event) => {
      await ingestEvent(event);
    },
  });
  await fw.start();
  console.error(
    JSON.stringify({ message: "file-watch started", watchDir }),
  );
}

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify(
      {
        message: "QEV Capture Gateway listening (seamless P0)",
        host: config.host,
        port: config.port,
        admin: `http://${config.host}:${config.port}/`,
        wizard: `http://${config.host}:${config.port}/wizard`,
        portal: `http://${config.host}:${config.port}/portal`,
        review: `http://${config.host}:${config.port}/review`,
        health: `http://${config.host}:${config.port}/v1/health`,
        preflight: `http://${config.host}:${config.port}/v1/preflight`,
        storage: config.storageDir,
        tenant: config.tenantId,
        signing_key_id: signingKeys.publicInfo().key_id,
        shadow_mode: config.shadowMode,
        status: "0.3.0-seamless-p0",
        note: "Customer data plane — plaintext does not leave this process to Qira",
      },
      null,
      2,
    ),
  );
});

