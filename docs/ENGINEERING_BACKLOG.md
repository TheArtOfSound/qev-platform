# QEV Ranked Engineering Backlog

**Sources (merged, not replaced):**

1. Commercial Platform Blueprint  
2. Deep Competitive Benchmark & Master Requirements  
3. Pilot-Ready Roadmap  
4. **End-to-End Automation & Seamless-Use Specification** (addendum — operational UX)

**Product center (unique):** gather selected evidence → source attribution → known gaps → policy → encrypt/sign → customer storage → multi-verdict verify without vendor accounts.

**Seamless definition (measurable):**

| Persona | Target |
|---|---|
| Normal business user | No terminal, no custom code for standard connectors |
| Small AI builder | One OTLP endpoint, one adapter, or `qev.capture(...)` |
| Operator | &lt;15 min first flow; shadow mode before live |

---

## Release gates (audit package — authoritative sequence)

Source: `docs/audit/QEV_Release_Gates.md` + 28 findings + 136 test cases.

| Gate | Before… | Status |
|---|---|---|
| **A** Public preview honesty | Further promotion | IN PROGRESS |
| **B** Synthetic platform | Historical AH Crap data | PARTIAL (gateway live) |
| **C** Historical-data test | Shadow mode | PARTIAL (template/import) |
| **D** Live shadow mode | Automatic sealing | NOT STARTED |
| **E** Limited live automation | Gate mode / outside customers | NOT READY |
| **F** QEV Protected Workflow badge | Public Protected mark | BLOCKED (correct) |

**Do not put live AH Crap customer data into commercial capture until Gate D+ and external review path are clear.**

## Rank tiers

| Rank | Meaning |
|---|---|
| **P0** | Blocks honest pilot / seamless first vertical |
| **P1** | Required before limited live AH Crap pilot |
| **P2** | Required before commercial Field Service product |
| **P3** | Enterprise / multi-industry / control plane |
| **P4** | Later scale, marketplace, full compliance theater |

---

## P0 — First complete seamless vertical (NOW)

> One install path → wizard → Field Service → 3 connectors → durable pipeline → seal → multi-verdict review → synthetic tests.

| ID | Item | Status |
|---|---|---|
| P0-01 | Customer gateway process | done |
| P0-02 | Frozen `qev.event.v1` | done |
| P0-03 | Evidence Bundle V1 + Vault V2 seal | done |
| P0-04 | Durable queue, DLQ, idempotency | done |
| P0-05 | Append-only case log | done |
| P0-06 | Field Service flow pack | done |
| P0-07 | Job portal / photo / webhook | done |
| P0-08 | Setup wizard (no YAML) | done |
| P0-09 | Multi-verdict review UI | done |
| P0-10 | Shadow mode default | done |
| P0-11 | Stage 1 synthetic suite | done |
| P0-12 | **One-command install (local pilot)** | **this sprint** |
| P0-13 | **Ed25519 org package signatures** | **this sprint** |
| P0-14 | **Preflight checks + block activation on critical fail** | **this sprint** |
| P0-15 | **Evidence completeness engine (auto)** | **this sprint** |
| P0-16 | **Case correlation (exact/high/uncertain)** | **this sprint** |
| P0-17 | **Operating modes: record / shadow / gate (gate soft)** | **this sprint** |
| P0-18 | **Health dashboard API + UI panel** | **this sprint** |
| P0-19 | **Stage 2 historical job template** | **this sprint** |
| P0-20 | **Sealed packages immutable; late events → supplemental** | **this sprint** |
| P0-21 | Ranked backlog document (this file) | done |
| P0-22 | **Auto-seal on completeness** | **done (Increment B)** |
| P0-23 | **Supplemental packages (no rewrite)** | **done (Increment B)** |
| P0-24 | **Watched-folder connector** | **done (Increment B)** |
| P0-25 | **Package seal certificates** | **done** |
| P0-26 | **Workflow trust cert model (narrow issuable levels)** | **done** |
| P0-27 | **SEO public-site scaffold + IndexNow script** | **done** |

---

## P0b — Trust + SEO (requirements; deploy on primary domain)

| ID | Item | Status |
|---|---|---|
| P0b-01 | Package seal certificate schema + API | done |
| P0b-02 | Workflow badge levels + anti-overclaim | done |
| P0b-03 | Refuse Protected / Independent badges until eligible | done |
| P0b-04 | public-site robots + sitemaps + intent pages | done (deploy pending) |
| P0b-05 | IndexNow submit script | done (key + CI pending) |
| P0b-06 | Deploy public-site to secure.imagineqira.com | **ops pending** |
| P0b-07 | GSC + Bing submit | **ops pending** |
| P0b-08 | Remove hash-route as primary marketing URL | **ops pending** |

---

## P1 — Before limited live pilot (AH Crap Stage 3–4)

| ID | Item |
|---|---|
| P1-01 | OS keychain / DPAPI credential store (no secrets in plain files) |
| P1-02 | Local TLS for gateway + auto cert |
| P1-03 | Token refresh lifecycle for OAuth connectors |
| P1-04 | Watched-folder connector (photos) with incomplete-write handling |
| P1-05 | Email `.eml` / forward path (privacy modes) |
| P1-06 | Automatic package seal on completion rule |
| P1-07 | Supplemental packages for late events (never rewrite sealed) |
| P1-08 | Notifications (local + email) for missing evidence / connector down |
| P1-09 | Backup + restore drill script |
| P1-10 | Stage 2 historical redacted suite (manual pack + automated checks) |
| P1-11 | Stage 3 shadow checklist + metrics export |
| P1-12 | Customer portal (external approve/upload/download only) |
| P1-13 | Passkey / SSO hooks (can stub IdP) |
| P1-14 | Accessibility pass on wizard/portal/review |
| P1-15 | Plain-language errors everywhere |

---

## P2 — Field Service commercial product

| ID | Item |
|---|---|
| P2-01 | One-click OAuth for Google Drive / M365 / calendar (Nango-class or Nango) |
| P2-02 | Permission explanation templates per connector |
| P2-03 | Polling, backfill UI, pagination, rate-limit budgets |
| P2-04 | Visual workflow rules editor |
| P2-05 | Durable workflow engine (Temporal pattern or embed) |
| P2-06 | Key rotation / rewrap (local first) |
| P2-07 | Recovery trustee + external reviewer time-boxed unlock |
| P2-08 | Large-file streaming encryption |
| P2-09 | Signed updates (TUF) + rollback |
| P2-10 | Connector self-repair + certification harness |
| P2-11 | Reporting pack (completeness, health, access, pilot metrics) |
| P2-12 | macOS notarized + Windows signed installers |
| P2-13 | Gate mode hard enforcement (optional per flow) |
| P2-14 | Billing that never locks owned packages |

---

## P3 — Enterprise / multi-flow

| ID | Item |
|---|---|
| P3-01 | KMS/HSM integration + customer-owned keys |
| P3-02 | WORM / legal hold storage options |
| P3-03 | Legal + AI + DevOps flow packs at product quality |
| P3-04 | OTLP receiver + GenAI mapping |
| P3-05 | OpenAI Agents / Bedrock / Copilot connectors |
| P3-06 | Clio / Graph / DocuSign |
| P3-07 | Control plane (license/health only, no plaintext) |
| P3-08 | Multi-workspace / environment isolation |
| P3-09 | Independent security audit |
| P3-10 | FRE 901/902 support documentation pack |

---

## P4 — Scale

| ID | Item |
|---|---|
| P4-01 | Connector marketplace |
| P4-02 | Helm + multi-region |
| P4-03 | Public Sigstore-style transparency for *hashes only* |
| P4-04 | Full ASVS 5 program |
| P4-05 | Browser extension (last resort) |

---

## Vertical slice definition of done (P0)

A nontechnical pilot operator can:

1. Run one install command (or Docker)  
2. Open local setup without terminal after install  
3. Select Field Service  
4. Enable three connectors with explained permissions  
5. Run synthetic test job  
6. See multi-verdict review with package signature  
7. See completeness + known gaps  
8. Survive gateway restart without losing queue/events  
9. Fail verification on tamper / wrong passphrase  

**Out of scope for P0:** OAuth providers, gate hard-block, KMS, notarized installers.

---

## Human confirmation still required (never fully auto)

- Connecting a new system with broad permissions  
- Enabling gate mode  
- Enabling irreversible retention locks  
- Granting external reviewer access  
- Deleting evidence packages  
- Changing privacy from redacted → full on sensitive fields  
- Production go-live after shadow mode  

---

## Build sequence (next 4 engineering increments)

1. **Increment A (this PR):** install script, Ed25519, preflight, completeness, matching, modes, health, Stage 2 template, backlog  
2. **Increment B:** watched folder, auto-seal, supplemental packages, metrics export  
3. **Increment C:** customer portal, notifications, backup drill  
4. **Increment D:** first OAuth connector + permission templates  

Then: Stage 2 historical → Stage 3 shadow → Stage 4 live pilot.
