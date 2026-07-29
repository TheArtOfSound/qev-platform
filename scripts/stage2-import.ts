/**
 * Stage 2 historical job importer.
 *
 *   pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.QEV_ENDPOINT ?? "http://127.0.0.1:7443";
const token = process.env.QEV_INGEST_TOKEN ?? "dev-ingest-token-change-me";
const pass = process.env.QEV_PACKAGE_PASSPHRASE ?? "change-me-for-local-dev-only";

interface HistAction {
  action: string;
  at?: string;
  actor?: string;
  payload?: Record<string, unknown>;
  file?: string;
}

interface HistMeta {
  case_id: string;
  title?: string;
  customer_label?: string;
  actions: HistAction[];
  questions_for_reviewer?: string[];
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const jobDir = args.find((a) => !a.startsWith("-") && !a.endsWith(".ts"));
  if (!jobDir) {
    console.error("Usage: pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001");
    process.exit(2);
  }
  const abs = path.resolve(jobDir);
  const meta = JSON.parse(
    await readFile(path.join(abs, "meta.json"), "utf8"),
  ) as HistMeta;

  console.log("== Stage 2 import ==");
  console.log("job:", abs);
  console.log("case_id:", meta.case_id);

  const health = await fetch(`${base}/healthz`);
  if (!health.ok) throw new Error("Gateway not healthy");

  for (const a of meta.actions) {
    if (a.file) {
      const filePath = path.join(abs, a.file);
      const buf = await readFile(filePath);
      const kind = a.action.includes("before")
        ? "before"
        : a.action.includes("after")
          ? "after"
          : "other";
      const res = await fetch(`${base}/v1/photos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: meta.case_id,
          kind,
          filename: path.basename(a.file),
          content_base64: buf.toString("base64"),
          actor: { id: a.actor ?? "historical@import" },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(body));
      console.log("  file", a.file, "→", body.status ?? "ok");
      // Also record named action if not pure evidence.* from photo connector
      if (
        a.action !== "evidence.before_captured" &&
        a.action !== "evidence.after_captured"
      ) {
        // photo connector already emits evidence.*; for invoice etc emit portal event with artifact
      }
      continue;
    }

    const res = await fetch(`${base}/v1/portal/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: meta.case_id,
        action: a.action,
        actor: { id: a.actor ?? "historical@import" },
        occurred_at: a.at,
        payload: {
          ...(a.payload ?? {}),
          historical_import: true,
          title: meta.title,
          customer_label: meta.customer_label,
        },
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(body));
    console.log("  event", a.action, "→", body.status);
  }

  // Completeness check
  const caseRes = await fetch(
    `${base}/v1/cases/field-service/${encodeURIComponent(meta.case_id)}`,
  );
  const caseBody = await caseRes.json();
  console.log("completeness:", caseBody.completeness);

  const seal = await fetch(`${base}/v1/flows/field-service/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ case_id: meta.case_id, passphrase: pass }),
  });
  const sealed = await seal.json();
  if (!seal.ok) throw new Error(JSON.stringify(sealed));
  console.log("sealed:", sealed.package_id);

  const ver = await fetch(`${base}/v1/packages/${sealed.package_id}/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ passphrase: pass }),
  });
  const report = await ver.json();

  const outDir = path.resolve("docs/stage2/out");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${meta.case_id}-report.json`);
  await writeFile(
    outFile,
    JSON.stringify(
      {
        imported_at: new Date().toISOString(),
        meta,
        completeness: caseBody.completeness,
        sealed,
        verification: report,
        reviewer_questions: meta.questions_for_reviewer,
      },
      null,
      2,
    ),
  );
  console.log("wrote", outFile);
  console.log("overall_ok:", report.overall_ok);
  console.log("package_signer:", report.package_signer);
  if (!report.overall_ok) process.exit(1);
  console.log("STAGE 2 IMPORT OK — fill evaluation table in STAGE2_HISTORICAL.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
