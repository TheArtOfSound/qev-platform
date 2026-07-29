#!/usr/bin/env node
/**
 * QEV package verifier CLI
 *
 * Usage:
 *   pnpm verify -- <path-to.qevpkg.json> --passphrase '...'
 *
 * Reports exact cryptographic properties. Does not claim legal proof,
 * AI truthfulness, or identity beyond what the package records.
 */
import { readFile } from "node:fs/promises";
import { openEvidencePackage, type QevPackageFile } from "@imagineqira/qev-core";
import { verifyEvidenceBundle } from "@imagineqira/qev-evidence-bundle";
import type { EvidenceBundleV1 } from "@imagineqira/qev-event-schema";

function usage(): never {
  console.error(`Usage: qev-verify <package.qevpkg.json> --passphrase <phrase>

Exit codes:
  0  overall_ok
  1  verification failed
  2  usage / IO error
`);
  process.exit(2);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("-")) usage();
  const passphrase = arg("--passphrase") ?? process.env.QEV_PACKAGE_PASSPHRASE;
  if (!passphrase) {
    console.error("Missing --passphrase or QEV_PACKAGE_PASSPHRASE");
    process.exit(2);
  }

  const raw = await readFile(file!, "utf8");
  const pkg = JSON.parse(raw) as QevPackageFile;

  let evidenceJson: string;
  let vault_sha256_ok: boolean;
  try {
    const opened = await openEvidencePackage(pkg, passphrase);
    evidenceJson = opened.evidenceJson;
    vault_sha256_ok = opened.vault_sha256_ok;
  } catch (e) {
    console.log(
      JSON.stringify(
        {
          overall_ok: false,
          decrypt_ok: false,
          failures: [e instanceof Error ? e.message : String(e)],
          claims: [],
          does_not_prove: [
            "anything — decrypt failed",
          ],
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const bundle = JSON.parse(evidenceJson) as EvidenceBundleV1;
  const report = verifyEvidenceBundle(bundle);

  const out = {
    package_id: pkg.package_id,
    flow_id: pkg.flow_id,
    case_id: pkg.case_id,
    vault_schema: pkg.vault.schema,
    vault_sha256_ok,
    decrypt_ok: true,
    bundle: report,
    summary: bundle.summary,
    known_gaps: bundle.known_gaps,
    claims: [
      ...(vault_sha256_ok
        ? ["Outer vault_sha256 matches sealed vault JSON"]
        : ["Outer vault_sha256 MISMATCH"]),
      "Vault V2 decrypt succeeded with provided passphrase",
      ...report.claims,
    ],
    failures: [
      ...(vault_sha256_ok ? [] : ["vault_sha256 mismatch"]),
      ...report.failures,
    ],
    overall_ok: vault_sha256_ok && report.overall_ok,
    does_not_prove: [
      "source-system honesty",
      "legal privilege or court admissibility",
      "AI answer correctness",
      "identity beyond recorded identity_assurance",
    ],
  };

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.overall_ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
