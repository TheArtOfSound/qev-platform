# Public Cleanup Plan — secure.imagineqira.com

**Goal:** One commercial product story before enterprise outreach.  
**Host:** Keep using `secure.imagineqira.com` (no new customer domain required).  
**Status labels:** `available today` | `working prototype` | `planned` | `requires independent review`

---

## 1. One product statement (homepage hero)

**Use:**

> QEV is a local-first encrypted evidence platform. Its envelope core protects portable records; its gateway and connectors capture selected evidence from real workflows before sealing it for later review.

**Do not lead with four unrelated products.** Map them as layers:

| Layer | Public name | Status |
|---|---|---|
| Envelope Core | Browser vault + desktop + CLI (Vault V2) | available today |
| Capture Gateway | Customer-controlled gateway | working prototype (`qev-platform` MVP) |
| Connectors / SDKs | Webhook, SDK; OTLP/GitHub planned | mixed |
| Flow Packs | DevOps MVP; AI/legal planned | mixed |
| Verify | CLI verify + planned browser/desktop | mixed |
| Control Plane | Licensing/updates only | planned |
| Qira Link | Paired mesh (sibling) | early alpha |

---

## 2. Fix package naming

| Issue | Fix |
|---|---|
| CLI published as `@bryan237l/qev-cli` | Publish/deprecate path to `@imagineqira/qev-cli` |
| Docs may mention both | Single name everywhere; old name “deprecated alias” note for 90 days |
| Platform packages | `@imagineqira/qev-*` (this monorepo) |

**Action items:**

1. Update `qev-cli/package.json` name on next release.
2. Update secure.imagineqira.com downloads + install snippets.
3. npm deprecation message on old package pointing to new name.
4. Compatibility table lists one CLI package.

---

## 3. Cipher language consistency

| Surface | Cipher | Label |
|---|---|---|
| Browser vault / Vault V2 | XChaCha20-Poly1305 + Argon2id | Envelope Core |
| Product preview sessions (Python path) | ChaCha20-Poly1305 | Policy demo / structured sessions |

**Public copy (short):**

> QEV Envelope Core (Vault V2) uses XChaCha20-Poly1305. The controlled-use policy session demo on this site uses ChaCha20-Poly1305 via the Python evaluation path. They are related product layers, not the same on-disk format. Commercial evidence packages seal Evidence Bundle V1 inside a Vault V2 content-key wrap.

---

## 4. Test counts and versions

Publish a **compatibility table** (new page `/compatibility` or section on downloads):

| Component | Version | Tests / notes | Vault V2 | Evidence Bundle V1 |
|---|---|---|---|---|
| Product preview (site) | 0.29.0 | 258 (220 product + 38 vault-tool) | — | — |
| CLI | 0.30.0 | self-test suite | read/write | planned open |
| Browser vault | 0.29.0–0.30.0 | — | read/write | no |
| Desktop | (shipped) | — | read/write | planned |
| qev-platform gateway | 0.1.0 MVP | monorepo vitest | seals via V2 | **write/verify** |

Explain why counts differ: different codebases, not “failed tests.”

---

## 5. Replace broad “proof” language

| Avoid | Prefer |
|---|---|
| “cryptographic proof of truth” | “content has not changed under this passphrase/key” |
| “proves who did it” | “records actor id with identity_assurance = source_asserted \| company_sso \| …” |
| “tamper-proof” | “tamper-evident: modified ciphertext fails AEAD / hash check” |
| “audit-ready for court” | “integrity + signature checks under stated trust model; not legal advice” |

Verifier UI/CLI must list **claims[]** and **does_not_prove[]** (gateway MVP already does).

---

## 6. Feature matrix page

Add “What exists today” vs “Platform roadmap”:

**Available today (Envelope Core)**

- Offline Vault V2 encrypt/decrypt
- Cross-device portable files
- Site integrity manifest (Ed25519)
- Controlled-use policy demo

**Working prototype (this platform MVP)**

- Signed webhook → `qev.event.v1`
- Policy evaluate (devops-change)
- Seal `QEV-EVIDENCE-BUNDLE-V1` inside Vault V2 package
- Local storage + verify API/CLI

**Planned**

- OTLP, GitHub, Clio, KMS, admin wizard, org signatures, large-file streaming

**Requires independent review**

- Enterprise “production security” claims
- Multi-tenant hostility assumptions
- Installer trust (Apple notarization, Authenticode)

---

## 7. Simulator labeling

Any public link to:

- Real Workflow Simulator
- Interactive Value Demo
- Reddit posting hubs
- Meeting walkthroughs

must say **Simulator / sales explainer — not the production gateway**.

---

## 8. Honest enterprise gaps (keep visible)

Already on homepage — keep and link from commercial pages:

- No KMS/HSM
- No formal key rotation/revocation
- Local trust model
- No third-party audit

Add: **customer-controlled gateway MVP does not close these gaps by itself.**

---

## 9. Suggested IA for secure.imagineqira.com

```text
/                     Product home (one stack)
/vault                Envelope Core (available)
/app                  Policy demo (available, controlled-use)
/downloads            Clients + CLI (available / alpha)
/platform             Gateway + connectors story (prototype + roadmap)
/compatibility        Version matrix
/verify               Site integrity
/challenge            Decryption challenge
/docs/*               Specs (link to GitHub qev-platform schemas)
```

`/platform` can be a static page on the same host describing:

- Docker one-liner when published
- OpenAPI link
- Flow packs
- “Plaintext stays in your environment”

---

## 10. Execution checklist

- [ ] Hero copy → one stack statement  
- [ ] CLI package rename + docs  
- [ ] Compatibility table live  
- [ ] Cipher explanation paragraph  
- [ ] Proof → exact claims pass  
- [ ] Simulators labeled  
- [ ] Platform page linking `qev-platform` once public  
- [ ] Feature status badges on every major CTA  
- [ ] Contact still `bryanleonard@imagineqira.com`  

**Owner:** product/site  
**Depends on:** this monorepo remaining the source of truth for gateway contracts in `schemas/`
