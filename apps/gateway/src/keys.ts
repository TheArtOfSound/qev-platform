import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  generateSigningKeyPair,
  publicKeyInfo,
  type SigningKeyPair,
} from "@imagineqira/qev-core";

/**
 * Local org signing key for pilot.
 * Private key stays on disk under data/ — OS keychain is P1.
 * Never log private_key.
 */
export class SigningKeyStore {
  private key: SigningKeyPair | null = null;

  constructor(private dir: string) {}

  private file(): string {
    return path.join(this.dir, "org-signing-key.json");
  }

  async init(): Promise<SigningKeyPair> {
    await mkdir(this.dir, { recursive: true });
    try {
      const raw = await readFile(this.file(), "utf8");
      this.key = JSON.parse(raw) as SigningKeyPair;
      return this.key;
    } catch {
      this.key = generateSigningKeyPair();
      await writeFile(this.file(), JSON.stringify(this.key, null, 2), {
        mode: 0o600,
      });
      return this.key;
    }
  }

  get(): SigningKeyPair {
    if (!this.key) throw new Error("Signing key not initialized");
    return this.key;
  }

  publicInfo() {
    return publicKeyInfo(this.get());
  }
}
