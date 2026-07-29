/**
 * Ed25519 package signatures for QEV-PACKAGE-V1.
 * Signs a compact commitment over package public fields + vault_sha256.
 * Does not put confidential content into a public transparency log.
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512.js";
import {
  b64urlDecode,
  b64urlEncode,
  canonicalJSON,
  sha256Hex,
} from "@imagineqira/qev-shared";

// noble-ed25519 v2 requires sha512 sync for some environments
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export const SIGN_ALG = "Ed25519";

export interface SigningKeyPair {
  key_id: string;
  public_key: string;
  private_key: string;
  created_at: string;
  algorithm: typeof SIGN_ALG;
}

export interface PackageSignature {
  algorithm: typeof SIGN_ALG;
  key_id: string;
  public_key: string;
  signature: string;
  signed_at: string;
  /** What was signed (for multi-verdict transparency). */
  payload_sha256: string;
}

export function generateSigningKeyPair(keyId?: string): SigningKeyPair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return {
    key_id: keyId ?? `org_${b64urlEncode(publicKey).slice(0, 12)}`,
    public_key: b64urlEncode(publicKey),
    private_key: b64urlEncode(privateKey),
    created_at: new Date().toISOString(),
    algorithm: SIGN_ALG,
  };
}

export function buildPackageSignPayload(input: {
  package_id: string;
  tenant_id: string;
  flow_id: string;
  case_id: string;
  vault_sha256: string;
  integrity_events_sha256: string;
  created_at: string;
}): string {
  return canonicalJSON({
    case_id: input.case_id,
    created_at: input.created_at,
    flow_id: input.flow_id,
    integrity_events_sha256: input.integrity_events_sha256,
    package_id: input.package_id,
    schema: "QEV-PACKAGE-V1",
    tenant_id: input.tenant_id,
    vault_sha256: input.vault_sha256,
  });
}

export async function signPackagePayload(
  payload: string,
  key: SigningKeyPair,
): Promise<PackageSignature> {
  const msg = new TextEncoder().encode(payload);
  const sig = await ed.signAsync(msg, b64urlDecode(key.private_key));
  return {
    algorithm: SIGN_ALG,
    key_id: key.key_id,
    public_key: key.public_key,
    signature: b64urlEncode(sig),
    signed_at: new Date().toISOString(),
    payload_sha256: sha256Hex(payload),
  };
}

export async function verifyPackageSignature(
  payload: string,
  signature: PackageSignature,
): Promise<{ ok: boolean; detail: string }> {
  try {
    if (signature.algorithm !== SIGN_ALG) {
      return { ok: false, detail: `Unsupported algorithm ${signature.algorithm}` };
    }
    if (sha256Hex(payload) !== signature.payload_sha256) {
      return { ok: false, detail: "payload_sha256 does not match signed payload" };
    }
    const msg = new TextEncoder().encode(payload);
    const ok = await ed.verifyAsync(
      b64urlDecode(signature.signature),
      msg,
      b64urlDecode(signature.public_key),
    );
    return {
      ok,
      detail: ok
        ? `Ed25519 signature valid for key_id ${signature.key_id}`
        : "Ed25519 signature invalid",
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Public key material only — safe to show in UI / support diagnostics. */
export function publicKeyInfo(key: SigningKeyPair): {
  key_id: string;
  public_key: string;
  algorithm: string;
  created_at: string;
} {
  return {
    key_id: key.key_id,
    public_key: key.public_key,
    algorithm: key.algorithm,
    created_at: key.created_at,
  };
}
