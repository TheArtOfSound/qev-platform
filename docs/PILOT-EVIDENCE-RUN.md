# Reproducing the pilot evidence run

First executed 2026-07-30. Before this, the gateway had processed
**0 cases and 0 packages** — the capture thesis had never been
demonstrated, which was the weakest fact in the commercial story.

This run produces real sealed evidence packages, real seal
certificates, and a verifier transcript you can hand to someone.
It is the demo, the proof, and the regression test.

## Run it

Use an isolated port and data directory so you never touch a running
instance:

```bash
cd qev-platform
pnpm install && pnpm build

export QEV_PORT=7455
export QEV_DATA_DIR=/tmp/qev-pilot-iso
export QEV_STORAGE_DIR=$QEV_DATA_DIR/packages
export QEV_INGEST_TOKEN=pilot-$(openssl rand -hex 10)
export QEV_WEBHOOK_SECRET=whs-$(openssl rand -hex 10)
export QEV_PACKAGE_PASSPHRASE=pass-$(openssl rand -hex 10)
export QEV_TENANT_ID=ahcrap-synthetic
export QEV_SHADOW_MODE=true
export QEV_ENDPOINT=http://127.0.0.1:7455

pnpm dev:gateway &      # terminal 1
pnpm pilot:synthetic    # terminal 2
```

Do **not** reuse the shipped default `QEV_INGEST_TOKEN`. The detailed
health report refuses it on purpose (audit F-15).

## What passed, 2026-07-30

```
[A] Happy path              seal · verify · content truth not claimed
[B] Missing after evidence  seal allowed in shadow · integrity ok · reports the gap
[C] Scope change w/o approval   timeline present
[D] Duplicate webhook       first accepted · second detected as duplicate
[E] Wrong passphrase        rejected
[F] Tampered package        vault_sha256 mismatch detected
STAGE 1 SYNTHETIC SUITE PASSED
```

Gateway state afterwards: **3 cases, 5 packages, 20 case-log entries,
hash chain verifies, 0 dead queue items.**

## The part that matters commercially

Package signatures are **Ed25519 with the public key embedded in the
package**:

```json
"package_signature": {
  "algorithm": "Ed25519",
  "key_id": "org_5i02ApZRMbJR",
  "public_key": "5i02ApZRMbJR7jzmxbwPGQ9ytaYdrsBuuEchZTwwM4I",
  "signature": "...",
  "payload_sha256": "..."
}
```

That is public-key attribution: a recipient can verify it **without a
shared secret and without our cooperation**. Note the contrast with the
public challenge bundle at `/challenge`, whose `signature.json` is an
HMAC-SHA256 tag keyed with the inline master key — that one proves
nothing to a third party. Do not describe both as "signed" in sales
material; only this one is independently verifiable.

## Verifier output, both directions

```bash
pnpm verify /tmp/qev-pilot-iso/packages/pkg_<id>.qevpkg.json
```

Good package — `overall_ok: true`, with the claims enumerated
individually rather than as one badge:

```
"claims": [
  "Outer vault_sha256 matches sealed vault JSON",
  "Vault V2 decrypt succeeded with provided passphrase",
  "schema is QEV-EVIDENCE-BUNDLE-V1",
  "events content matches integrity.events_sha256",
  "bundle content matches integrity.bundle_sha256",
  "artifact before.txt has a well-formed sha256 fingerprint",
  "artifact after.txt has a well-formed sha256 fingerprint"
],
"failures": [],
"overall_ok": true,
"does_not_prove": [
  "source-system honesty",
  "legal privilege or court admissibility",
  "AI answer correctness",
  "identity beyond recorded identity_assurance"
]
```

Tampered package — exits non-zero and, importantly, claims nothing:

```
"overall_ok": false,
"failures": ["Wrong passphrase or corrupted vault content."],
"claims": [],
"does_not_prove": ["anything — decrypt failed"]
```

That refusal to assert anything on failure is the product's actual
differentiator. Show both outputs side by side — the failure case is
more persuasive to a technical buyer than the success case.

## Seal certificates

`packages/certificates/SEAL-<package_id>.json` carries
`evidence_completeness` (e.g. `5/5 required present`), a `known_gaps`
array, and `signature_result`. This is the "separate checks, not one
green badge" position implemented rather than asserted.

## Next stage

Stage 2 is redacted historical Ah Crap jobs, and it is manual. Do not
skip to live jobs — the staging order is synthetic → historical →
shadow → live, and shadow mode exists precisely so capture runs
alongside the real process without controlling it.
