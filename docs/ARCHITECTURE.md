# QEV Platform Architecture (MVP)

## Principle

Customer data plane never requires Qira to see plaintext, documents, prompts, or encryption keys.

```text
[ Source systems ]
   | signed webhook / SDK / (OTLP planned)
   v
[ QEV Capture Gateway ]  <-- runs in customer env
   | normalize -> qev.event.v1
   | policy engine
   | build QEV-EVIDENCE-BUNDLE-V1
   | seal with Vault V2 content-key wrap
   v
[ Customer storage ]  .qevpkg.json
   v
[ QEV Verify ]  claims + known gaps
```

## Formats

| Schema | Purpose |
|---|---|
| `qev.event.v1` | Canonical normalized event |
| `QEV-EVIDENCE-BUNDLE-V1` | Multi-event evidence plaintext |
| `QEV-PACKAGE-V1` | On-disk wrapper: public meta + Vault V2 |
| `BRY-NFET-SX-VAULT-V2` | Encryption envelope (do not break) |

## Trust distinctions

**Identity:** typed | source_asserted | company_sso | cryptographically_signed | device_bound  

**Time:** source_system_time | gateway_receipt_time | org_signed_time | independent_timestamp  

**Verification claims are exact** — see verifier `claims[]` / `does_not_prove[]`.

## MVP status

| Path | Status |
|---|---|
| Signed webhook | implemented |
| JS SDK client | implemented |
| Policy (devops-change) | implemented |
| Local package storage | implemented |
| Verify API + CLI | implemented |
| OTLP / GitHub / admin UI | stub / planned |
| KMS key slots | planned |
