/**
 * Issue a QEV entitlement licence.
 *
 *   pnpm tsx scripts/issue-license.ts --init-key            # once, ever
 *   pnpm tsx scripts/issue-license.ts \
 *     --org "AH Crap Cleanup" --tier pilot --days 90 \
 *     --contact bryan@example.com --out license.json
 *
 * The customer drops license.json into their gateway's QEV_DATA_DIR and
 * restarts. Nothing phones home: a self-hosted gateway must keep working
 * without reaching Qira, so verification is offline against a pinned key.
 *
 * WHAT A LICENCE CAN AND CANNOT DO
 * --------------------------------
 * It can pause NEW capture. It cannot touch evidence that already exists:
 * opening, verifying, listing and exporting packages are not gateable, by
 * construction (see apps/gateway/src/license.ts). Expiry is not a kill
 * switch and must never be sold as one.
 *
 * PILOTS ARE FREE AND TIME-BOXED
 * ------------------------------
 * A company that wants to genuinely try this gets a real gateway with real
 * limits for a real window, at no cost. That is not generosity - the
 * capture thesis had processed zero packages before 2026-07-30, so
 * evidence of it working in someone else's workflow is worth more than
 * pilot revenue.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as ed from "@noble/ed25519";
import { canonicalJSON, sha256Hex, b64urlEncode, b64urlDecode, newId } from "@imagineqira/qev-shared";

const KEY_FILE = path.resolve("data/license-issuing-key.json");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (n: string) => process.argv.includes(`--${n}`);

function licensePayload(l: Record<string, unknown>): string {
  return canonicalJSON({
    expires_at: l.expires_at,
    grace_days: l.grace_days,
    issued_at: l.issued_at,
    license_id: l.license_id,
    limits: l.limits,
    notes: l.notes ?? "",
    org: l.org,
    schema: l.schema,
    tier: l.tier,
  });
}

async function initKey(): Promise<void> {
  try {
    await readFile(KEY_FILE, "utf8");
    console.error(
      `Refusing to overwrite ${KEY_FILE}.\n` +
      `Regenerating the issuing key invalidates every licence already issued.\n` +
      `Move the existing file aside deliberately if that is really what you want.`,
    );
    process.exit(2);
  } catch { /* absent - good */ }
  const priv = ed.utils.randomPrivateKey();
  const pub = await ed.getPublicKeyAsync(priv);
  await mkdir(path.dirname(KEY_FILE), { recursive: true });
  await writeFile(
    KEY_FILE,
    JSON.stringify({ private_key: b64urlEncode(priv), public_key: b64urlEncode(pub) }, null, 2),
    { mode: 0o600 },
  );
  console.log(`Issuing key written to ${KEY_FILE} (mode 0600).`);
  console.log(`\nPublic key — pin this on every gateway:\n  ${b64urlEncode(pub)}\n`);
  console.log(`Set it as QEV_LICENSE_PUBKEY, or bake it into license.ts.`);
  console.log(`Back up the private key offline. Losing it means re-issuing every licence.`);
}

async function main(): Promise<void> {
  if (has("init-key")) return initKey();

  const org = arg("org");
  if (!org) {
    console.error(
      "usage: issue-license.ts --org NAME [--tier pilot|team|design_partner]\n" +
      "                       [--days N] [--packages N] [--cases N]\n" +
      "                       [--contact EMAIL] [--notes TEXT] [--out FILE]\n" +
      "       issue-license.ts --init-key",
    );
    process.exit(2);
  }
  const tier = arg("tier", "pilot") as "pilot" | "team" | "design_partner";
  if (!["pilot", "team", "design_partner"].includes(tier)) {
    console.error(`Unknown tier "${tier}".`); process.exit(2);
  }

  // Pilots are time-boxed by default; team licences are perpetual unless
  // a window is asked for. A pilot with no end date is not a pilot.
  const daysRaw = arg("days");
  const days = daysRaw ? Number(daysRaw) : tier === "pilot" ? 90 : 0;
  const now = new Date();
  const expires_at = days > 0
    ? new Date(now.getTime() + days * 86_400_000).toISOString()
    : null;

  const num = (n: string | undefined) => (n ? Number(n) : null);
  const license = {
    schema: "QEV-LICENSE-V1",
    license_id: `LIC-${newId().toUpperCase().slice(0, 10)}`,
    tier,
    org: { name: org, ...(arg("contact") ? { contact: arg("contact") } : {}) },
    issued_at: now.toISOString(),
    expires_at,
    limits: { packages: num(arg("packages")), cases: num(arg("cases")) },
    grace_days: Number(arg("grace", "14")),
    notes: arg("notes", ""),
  };

  let keyRaw: string;
  try {
    keyRaw = await readFile(KEY_FILE, "utf8");
  } catch {
    console.error(`No issuing key at ${KEY_FILE}. Run --init-key first.`);
    process.exit(2);
    return;
  }
  const key = JSON.parse(keyRaw) as { private_key: string; public_key: string };

  const payload = licensePayload(license);
  const sig = await ed.signAsync(new TextEncoder().encode(payload), b64urlDecode(key.private_key));
  const signed = {
    ...license,
    signature: {
      algorithm: "ed25519",
      public_key: key.public_key,
      signature: b64urlEncode(sig),
      signed_at: now.toISOString(),
      payload_sha256: sha256Hex(payload),
    },
  };

  const out = arg("out", "license.json")!;
  await writeFile(out, JSON.stringify(signed, null, 2) + "\n");

  console.log(`Wrote ${out}`);
  console.log(`  id       ${signed.license_id}`);
  console.log(`  org      ${org}`);
  console.log(`  tier     ${tier}`);
  console.log(`  expires  ${expires_at ?? "never"}${expires_at ? ` (+${signed.grace_days}d grace)` : ""}`);
  console.log(`  limits   packages=${signed.limits.packages ?? "unlimited"} cases=${signed.limits.cases ?? "unlimited"}`);
  console.log(`\nSend it with this, verbatim — it is the part that matters:`);
  console.log(`  "Drop this in your gateway's data directory and restart.`);
  console.log(`   If it expires, new capture pauses. Every package you have already`);
  console.log(`   sealed stays readable, verifiable and exportable with your own keys —`);
  console.log(`   we cannot lock your evidence, and the gateway has no code path to try."`);
}

main().catch((e) => { console.error(e); process.exit(1); });
