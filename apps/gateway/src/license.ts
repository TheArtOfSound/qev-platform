/**
 * Entitlements for the capture gateway.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * /pricing says: "Even if you later stop a subscription, packages sealed
 * with your keys remain openable with those keys. We do not hold a hostage
 * master key for your vault files."
 *
 * That was a promise in prose with nothing behind it. Here it is machine-
 * enforced: entitlements can gate CAPTURE and nothing else. Reading,
 * verifying, listing, exporting and downloading evidence are not gateable
 * at all — there is deliberately no code path that can refuse them, so a
 * lapsed licence cannot strand a customer's own records.
 *
 * If someone later adds a paid feature, add it to CAPTURE_ACTIONS. Adding
 * anything to the read side is a breach of the published promise and the
 * tests will fail.
 *
 * WHY EVALUATION IS UNLICENSED AND UNLIMITED IN TIME
 * -------------------------------------------------
 * A company that wants to try this should not have to ask permission
 * first. With no licence file the gateway runs in `evaluation`: capture
 * works immediately, capped by volume rather than by clock, so an
 * evaluation can never expire mid-job and leave someone stuck. The cap is
 * a nudge to talk to us, not a cliff.
 *
 * WHY LICENCES ARE ED25519-SIGNED
 * ------------------------------
 * Same primitive already used for package signatures and site integrity —
 * no new trust root, and a customer can verify their own licence with the
 * tools they already have. Offline: a self-hosted gateway must never need
 * to phone Qira to keep working.
 */
import { readFile } from "node:fs/promises";
import * as ed from "@noble/ed25519";
import { canonicalJSON, sha256Hex, b64urlDecode } from "@imagineqira/qev-shared";

export const LICENSE_SCHEMA = "QEV-LICENSE-V1";

/**
 * Qira's licence-issuing public key. Pinned so a licence cannot be forged
 * by swapping in another key alongside it.
 *
 * Placeholder until the issuing key is generated — see
 * scripts/issue-license.ts. While it is empty every licence is rejected
 * and the gateway falls back to evaluation, which is the safe direction:
 * customers keep working, nobody gets a free unlimited tier from a
 * malformed file.
 */
export const QIRA_LICENSE_PUBKEY = process.env.QEV_LICENSE_PUBKEY ?? "";

export type Tier = "evaluation" | "pilot" | "team" | "design_partner";

/** Volume caps. null means uncapped. */
export interface TierLimits {
  packages: number | null;
  cases: number | null;
}

/**
 * Evaluation is capped by volume, never by time. 250 packages is well
 * past "is this real?" and well short of running a business on it.
 */
export const EVALUATION_LIMITS: TierLimits = { packages: 250, cases: 50 };

export interface License {
  schema: string;
  license_id: string;
  tier: Exclude<Tier, "evaluation">;
  org: { name: string; contact?: string };
  issued_at: string;
  /** null = perpetual. Pilots are time-boxed; team licences usually are not. */
  expires_at: string | null;
  limits: TierLimits;
  /**
   * Days after expiry during which capture still works. Exists so a
   * renewal conversation never coincides with capture silently stopping
   * in the middle of someone's workday.
   */
  grace_days: number;
  notes?: string;
  signature?: {
    algorithm: string;
    public_key: string;
    signature: string;
    signed_at: string;
    payload_sha256: string;
  };
}

/** Actions that MAY be gated. Capture only — see the header. */
export const CAPTURE_ACTIONS = [
  "ingest_event",
  "portal_event",
  "upload_photo",
  "webhook_event",
  "seal_case",
] as const;
export type CaptureAction = (typeof CAPTURE_ACTIONS)[number];

export type Entitlement =
  | { allowed: true; tier: Tier; reason?: string; warning?: string }
  | { allowed: false; tier: Tier; reason: string; remedy: string };

export function licensePayload(l: License): string {
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

export async function verifyLicense(
  l: License,
  pinnedPubKey: string = QIRA_LICENSE_PUBKEY,
): Promise<{ ok: boolean; detail: string }> {
  if (l.schema !== LICENSE_SCHEMA) {
    return { ok: false, detail: `Unexpected schema ${l.schema}` };
  }
  if (!l.signature) return { ok: false, detail: "Licence is unsigned" };
  if (!pinnedPubKey) {
    return { ok: false, detail: "No pinned licence key configured on this gateway" };
  }
  if (l.signature.public_key !== pinnedPubKey) {
    return { ok: false, detail: "Licence is not signed by the pinned Qira key" };
  }
  const payload = licensePayload(l);
  if (sha256Hex(payload) !== l.signature.payload_sha256) {
    return { ok: false, detail: "payload_sha256 does not match the licence body" };
  }
  try {
    const ok = await ed.verifyAsync(
      b64urlDecode(l.signature.signature),
      new TextEncoder().encode(payload),
      b64urlDecode(l.signature.public_key),
    );
    return ok
      ? { ok: true, detail: "Signature valid" }
      : { ok: false, detail: "Signature does not verify" };
  } catch (e) {
    return { ok: false, detail: `Signature check failed: ${(e as Error).message}` };
  }
}

export async function loadLicense(file: string): Promise<License | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as License;
  } catch {
    return null; // absent or unreadable -> evaluation, never a hard failure
  }
}

export interface UsageSnapshot {
  packages: number;
  cases: number;
}

/**
 * The only gate in the system.
 *
 * Deliberately takes a CaptureAction and nothing else — there is no way to
 * ask this function whether someone may READ their evidence, because the
 * answer is always yes and encoding that as a question invites a future
 * change that gets it wrong.
 */
export async function entitlementForCapture(
  action: CaptureAction,
  license: License | null,
  usage: UsageSnapshot,
  now: Date = new Date(),
): Promise<Entitlement> {
  void action;

  if (!license) {
    const overPackages =
      EVALUATION_LIMITS.packages !== null && usage.packages >= EVALUATION_LIMITS.packages;
    const overCases =
      EVALUATION_LIMITS.cases !== null && usage.cases >= EVALUATION_LIMITS.cases;
    if (overPackages || overCases) {
      return {
        allowed: false,
        tier: "evaluation",
        reason:
          `Evaluation limit reached (${usage.packages}/${EVALUATION_LIMITS.packages} packages, ` +
          `${usage.cases}/${EVALUATION_LIMITS.cases} cases).`,
        remedy:
          "Existing packages remain fully readable, verifiable and exportable — nothing is " +
          "locked. Only new capture is paused. A free time-boxed pilot licence lifts this: " +
          "bryanleonard@imagineqira.com, subject 'Pilot licence'.",
      };
    }
    const near =
      EVALUATION_LIMITS.packages !== null &&
      usage.packages >= EVALUATION_LIMITS.packages * 0.8;
    return {
      allowed: true,
      tier: "evaluation",
      reason: "Unlicensed evaluation",
      ...(near
        ? {
            warning:
              `Evaluation is ${usage.packages}/${EVALUATION_LIMITS.packages} packages used. ` +
              "Ask for a free pilot licence before you hit the cap.",
          }
        : {}),
    };
  }

  const v = await verifyLicense(license);
  if (!v.ok) {
    // An invalid licence must not be worse than no licence. Fall back to
    // evaluation rather than refusing — a broken file should not take a
    // customer's capture offline.
    return entitlementForCapture(action, null, usage, now);
  }

  if (license.expires_at) {
    const exp = new Date(license.expires_at).getTime();
    const graceMs = Math.max(0, license.grace_days) * 86_400_000;
    if (now.getTime() > exp + graceMs) {
      return {
        allowed: false,
        tier: license.tier,
        reason:
          `Licence ${license.license_id} expired ${license.expires_at}` +
          (license.grace_days ? ` (plus ${license.grace_days} days grace)` : "") + ".",
        remedy:
          "Every package already sealed stays readable, verifiable and exportable with your " +
          "own keys — this pauses new capture only. Renew: bryanleonard@imagineqira.com.",
      };
    }
    if (now.getTime() > exp) {
      const left = Math.ceil((exp + graceMs - now.getTime()) / 86_400_000);
      return {
        allowed: true,
        tier: license.tier,
        reason: "Within grace period",
        warning: `Licence expired ${license.expires_at}; capture continues for ${left} more day(s).`,
      };
    }
  }

  const lim = license.limits ?? { packages: null, cases: null };
  if (lim.packages !== null && usage.packages >= lim.packages) {
    return {
      allowed: false,
      tier: license.tier,
      reason: `Licence package limit reached (${usage.packages}/${lim.packages}).`,
      remedy:
        "Existing evidence is unaffected and stays fully accessible. Raise the limit: " +
        "bryanleonard@imagineqira.com.",
    };
  }
  return { allowed: true, tier: license.tier, reason: `Licensed: ${license.tier}` };
}

/**
 * Public, non-sensitive summary for /v1/health and the admin UI. Never
 * includes the signature or anything that would let a licence be replayed.
 */
export function licenseSummary(l: License | null, usage: UsageSnapshot) {
  if (!l) {
    return {
      tier: "evaluation" as Tier,
      licensed: false,
      limits: EVALUATION_LIMITS,
      usage,
      expires_at: null,
      note:
        "Unlicensed evaluation: capture is capped by volume, never by time, so it cannot " +
        "expire mid-job. Reading and verifying evidence is never limited.",
    };
  }
  return {
    tier: l.tier,
    licensed: true,
    org: l.org?.name,
    limits: l.limits,
    usage,
    expires_at: l.expires_at,
    grace_days: l.grace_days,
    note: "Entitlements gate capture only. Existing evidence is always readable and verifiable.",
  };
}
