/**
 * QEV Vault V2 — BRY-NFET-SX-VAULT-V2 compatible.
 * XChaCha20-Poly1305 + Argon2id with wrapped content key.
 *
 * Adapted from qev-evidence @qev/vault for platform use.
 * Do not break interop with browser vault / CLI / desktop.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import {
  b64urlDecode,
  b64urlEncode,
  canonicalJSON,
  utf8,
  fromUtf8,
} from "@imagineqira/qev-shared";

export const SCHEMA_V2 = "BRY-NFET-SX-VAULT-V2";
export const VAULT_VERSION = "0.30.0";
export const KDF_ALG = "argon2id";
export const AEAD_ALG = "XChaCha20-Poly1305";

const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const KEY_BYTES = 32;

export const LOCK_PRESETS = {
  quick: { opslimit: 1, memlimit: 32 * 1024 * 1024 },
  strong: { opslimit: 4, memlimit: 96 * 1024 * 1024 },
  vault: { opslimit: 6, memlimit: 128 * 1024 * 1024 },
} as const;

export type PresetKey = keyof typeof LOCK_PRESETS;

export interface QevVault {
  schema: string;
  version: string;
  created_at: string;
  mode: "self" | "share";
  kdf: {
    algorithm: string;
    opslimit: number;
    memlimit: number;
    salt: string;
  };
  wrap: {
    algorithm: string;
    nonce: string;
    wrapped_key: string;
  };
  content: {
    algorithm: string;
    nonce: string;
    ciphertext: string;
  };
}

export async function ready(): Promise<void> {
  return;
}

export function buildAADV2(vault: QevVault): Uint8Array {
  return utf8(
    canonicalJSON({
      content: {
        algorithm: vault.content.algorithm,
        nonce: vault.content.nonce,
      },
      created_at: vault.created_at,
      kdf: {
        algorithm: vault.kdf.algorithm,
        memlimit: vault.kdf.memlimit,
        opslimit: vault.kdf.opslimit,
        salt: vault.kdf.salt,
      },
      mode: vault.mode,
      schema: vault.schema,
      version: vault.version,
      wrap: {
        algorithm: vault.wrap.algorithm,
        nonce: vault.wrap.nonce,
      },
    }),
  );
}

function derivePhraseKey(
  password: string,
  salt: Uint8Array,
  opslimit: number,
  memlimit: number,
): Uint8Array {
  const t = Math.max(1, opslimit);
  const m = Math.max(8 * 1024, Math.floor(memlimit / 1024));
  return argon2id(utf8(password), salt, { t, m, p: 1, dkLen: KEY_BYTES });
}

function aeadEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array | null,
): Uint8Array {
  const cipher = xchacha20poly1305(key, nonce, aad ?? undefined);
  return cipher.encrypt(plaintext);
}

function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array | null,
): Uint8Array {
  const cipher = xchacha20poly1305(key, nonce, aad ?? undefined);
  return cipher.decrypt(ciphertext);
}

export async function encryptVaultV2(opts: {
  plaintext: string | Uint8Array;
  password: string;
  mode?: "self" | "share";
  preset?: PresetKey;
  salt?: Uint8Array;
  wrapNonce?: Uint8Array;
  contentNonce?: Uint8Array;
  vaultKey?: Uint8Array;
  createdAt?: string;
  version?: string;
}): Promise<QevVault> {
  await ready();
  if (!opts.password) throw new Error("A passphrase is required to lock the package.");
  const mode = opts.mode ?? "self";
  const preset = LOCK_PRESETS[opts.preset ?? "quick"];
  const pt =
    typeof opts.plaintext === "string" ? utf8(opts.plaintext) : opts.plaintext;

  const salt = opts.salt ? new Uint8Array(opts.salt) : randomBytes(SALT_BYTES);
  const wrapNonce = opts.wrapNonce
    ? new Uint8Array(opts.wrapNonce)
    : randomBytes(NONCE_BYTES);
  const contentNonce = opts.contentNonce
    ? new Uint8Array(opts.contentNonce)
    : randomBytes(NONCE_BYTES);
  const vaultKey = opts.vaultKey
    ? new Uint8Array(opts.vaultKey)
    : randomBytes(KEY_BYTES);

  const phraseKey = derivePhraseKey(
    opts.password,
    salt,
    preset.opslimit,
    preset.memlimit,
  );

  const created_at = opts.createdAt ?? new Date().toISOString();
  const partial: QevVault = {
    schema: SCHEMA_V2,
    version: opts.version ?? VAULT_VERSION,
    created_at,
    mode,
    kdf: {
      algorithm: KDF_ALG,
      opslimit: preset.opslimit,
      memlimit: preset.memlimit,
      salt: b64urlEncode(salt),
    },
    wrap: {
      algorithm: AEAD_ALG,
      nonce: b64urlEncode(wrapNonce),
      wrapped_key: "",
    },
    content: {
      algorithm: AEAD_ALG,
      nonce: b64urlEncode(contentNonce),
      ciphertext: "",
    },
  };

  const aad = buildAADV2(partial);
  const wrapped = aeadEncrypt(phraseKey, wrapNonce, vaultKey, aad);
  partial.wrap.wrapped_key = b64urlEncode(wrapped);
  const ciphertext = aeadEncrypt(vaultKey, contentNonce, pt, aad);
  partial.content.ciphertext = b64urlEncode(ciphertext);

  phraseKey.fill(0);
  vaultKey.fill(0);

  return partial;
}

export async function decryptVaultV2(
  vault: QevVault,
  password: string,
): Promise<Uint8Array> {
  await ready();
  if (vault.schema !== SCHEMA_V2) {
    throw new Error(`Unsupported vault schema: ${vault.schema}`);
  }
  if (!password) throw new Error("Passphrase required.");

  const salt = b64urlDecode(vault.kdf.salt);
  const wrapNonce = b64urlDecode(vault.wrap.nonce);
  const wrapped = b64urlDecode(vault.wrap.wrapped_key);
  const contentNonce = b64urlDecode(vault.content.nonce);
  const ciphertext = b64urlDecode(vault.content.ciphertext);

  const phraseKey = derivePhraseKey(
    password,
    salt,
    vault.kdf.opslimit,
    vault.kdf.memlimit,
  );

  const aad = buildAADV2(vault);

  let vaultKey: Uint8Array;
  try {
    vaultKey = aeadDecrypt(phraseKey, wrapNonce, wrapped, aad);
  } catch {
    phraseKey.fill(0);
    throw new Error("Wrong passphrase or corrupted vault wrap.");
  }

  try {
    const pt = aeadDecrypt(vaultKey, contentNonce, ciphertext, aad);
    phraseKey.fill(0);
    vaultKey.fill(0);
    return pt;
  } catch {
    phraseKey.fill(0);
    vaultKey.fill(0);
    throw new Error("Wrong passphrase or corrupted vault content.");
  }
}

export async function decryptVaultV2Text(
  vault: QevVault,
  password: string,
): Promise<string> {
  return fromUtf8(await decryptVaultV2(vault, password));
}
