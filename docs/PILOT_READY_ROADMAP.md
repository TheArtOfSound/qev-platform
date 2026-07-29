# QEV Pilot-Ready Roadmap

**Date:** 2026-07-29  
**Principle:** AH Crap (or any field business) is the **first deployment** of a reusable platform — not the place architecture is invented.

> Build the reusable QEV platform slice properly → synthetic jobs → historical jobs → shadow mode → limited live pilot → automation → gate mode → Field Service product.

---

## What QEV uniquely owns

1. Select evidence across systems  
2. Normalize into one portable model  
3. Bind each fact to source, identity strength, fingerprint, policy, capture method  
4. State what was **not** captured  
5. Freeze the workflow record  
6. Encrypt under customer-controlled unlock paths  
7. Sign for independent verification  
8. Optional time anchor / append-only history  
9. Customer-selected storage  
10. Open/verify **without** the original vendor account  
11. Readable multi-verdict review + certification packet  

**Do not rebuild:** Nango-class OAuth, Temporal-class durable workflow engines, Phoenix/LangSmith AI labs, full Purview eDiscovery, cloud KMS products. **Integrate or borrow patterns.**

---

## Correct testing sequence

| Stage | Name | Purpose | Gate to next |
|---|---|---|---|
| **0** | Platform foundation | Gateway, schema, bundle, queue, connectors, wizard, verifier | Synthetic suite green |
| **1** | Synthetic jobs | Fake customers, missing photos, dupes, wrong IDs, tamper | Reliability + UX acceptable |
| **2** | Historical jobs | Redacted real AH Crap archives | Record explains job; not too noisy |
| **3** | Shadow mode | Live jobs recorded; no control/blocking | Connectors stable; low manual fix rate |
| **4** | Limited live pilot | 5–10 selected jobs | Metrics: setup time, time/job, gaps, disputes value |
| **5** | Automation | Auto folders, approval links, seal | Human override still available |
| **6** | Gate mode | Block start without approval; block seal without required evidence | Explicit customer opt-in |

---

## Stage 0 checklist (before any real customer data)

### Must have for pilot

- [x] Customer-controlled gateway process  
- [x] Frozen `qev.event.v1` (+ field-service aliases)  
- [x] `QEV-EVIDENCE-BUNDLE-V1` multi-event packages  
- [x] Vault V2 seal (content-key wrap)  
- [x] Generic signed webhook  
- [x] Multi-verdict claims (not single “Verified”)  
- [ ] Durable disk queue + DLQ + idempotency  
- [ ] Append-only case log (CloudTrail-style chaining of package events)  
- [ ] Field Service flow pack (required vs optional steps)  
- [ ] Setup wizard (no YAML for operators)  
- [ ] Job Portal connector surface  
- [ ] Photo/file connector (local folder + upload)  
- [ ] Email/webhook generic path  
- [ ] Review screen (browser)  
- [ ] Shadow mode flag  
- [ ] Credential hygiene (no secrets in logs)  
- [ ] Backup path for packages  
- [ ] Synthetic field-service test harness  
- [ ] One-command local run (`pnpm pilot` / Docker)

### Not required for first internal pilot

- Full SOC 2 / third-party audit  
- Cloud KMS / HSM  
- Every legal/AI connector  
- Irreversible WORM (optional later; wizard must warn)  
- Public Sigstore transparency log for confidential content  
- National control plane  
- Marketplace of connectors  
- Complex billing  

### Required before *enterprise* claims (post-pilot)

- Signed/notarized installers, TUF updates, SBOM, SLSA  
- KMS rewrap/rotation, customer-owned keys, kill switch semantics  
- Independent crypto + app security review  
- Legal review of industry claims  

---

## Field Service flow (pack definition)

```text
job.created
estimate.prepared
estimate.approved
evidence.before_captured
work.started
scope.changed          # optional
change.approved        # if scope changed
work.completed
evidence.after_captured
invoice.issued
payment.recorded
customer.completion_confirmed
package.sealed
```

**Required for seal (default pack):** job.created, estimate.approved, evidence.before_captured, work.completed, evidence.after_captured  
**Optional:** scope/change, invoice, payment, customer completion  
**Missing items → known_gaps**, not silent omission.

---

## Multi-verdict review (never one green badge)

```text
Package integrity:        Verified | Failed
Package signer:           Verified | Not present | Failed
Source webhook:           Verified | Not applicable | Failed
Actor identity:           typed | source_asserted | company_sso | signed | device_bound
Artifact match:           Verified | Partial | Failed
Time:                     Gateway observed | Source system | Org signed | External anchor
External time anchor:     Present | Not present
Required evidence:        N of M
Known gaps:               (list)
Shadow mode:              On | Off
Content truth:            Not independently determined
Post-seal rewrite:        None (sealed packages immutable)
```

---

## Borrowed patterns (implementation notes)

| Source | Borrow |
|---|---|
| Stripe webhooks | Signature verify, async process, idempotency, unordered delivery |
| Temporal | Durable progress; resume after crash |
| Nango / Workato | Connection wizard, health, recipes = flow packs |
| CloudTrail | Hash + chain digests; detect missing intervals |
| RFC 8785 | Canonical JSON (implemented as qev-canonical-json/v1) |
| HashiCorp Transit / KMS | Data keys, rewrap (post-pilot for full KMS) |
| Azure/GCS WORM | Optional retention locks (post-pilot) |
| OpenTelemetry | AI path later; do not replace Phoenix |

---

## Product decision (frozen)

> **Do not build another industry demo. Build gateway, connector runtime, evidence model, trust model, package format, and verifier first. Then AH Crap is deployment #1 of a real Field Service Evidence product.**

---

## Implementation status in this monorepo

See `docs/STAGE0_STATUS.md` (generated with the pilot slice).  
Run: `pnpm pilot` after install.
