# Audit findings status matrix

**Audit package date:** 2026-07-29  
**Matrix date:** 2026-07-29 (post qev-platform pilot deploy)

**Overall agreement with audit executive verdict:**  
**Still not ready for live AH Crap customer data.** The envelope core is real; commercial completeness for production customer evidence is not.  

**Important correction to audit F-001 / F-006 / F-019 as of this matrix:**  
A **P0 pilot gateway** *has* been built and deployed at  
https://secure.imagineqira.com/platform/  
It is **not** a finished commercial product. Status below uses:  
`PASS` · `PARTIAL` · `FAIL` · `NOT BUILT` · `PLANNED` · `IN PROGRESS`

---

## Release gates (from audit)

| Gate | Meaning | Status now |
|---|---|---|
| **A** Public preview honesty | Identity, claims, integrity, naming | **IN PROGRESS** |
| **B** Synthetic platform | Gateway vertical slice + failure tests | **PARTIAL** (core slice live; not full suite) |
| **C** Historical data | Redacted AH Crap import | **PARTIAL** (template + importer; not full jobs) |
| **D** Live shadow | Real ops, no control | **NOT STARTED** |
| **E** Limited automation | Auto seal + external review | **NOT READY** |
| **F** Protected Workflow badge | Continuous checks + independent assess | **BLOCKED** (correctly) |

---

## Findings F-001 … F-028

| ID | Sev | Audit status | Status after pilot work | Notes |
|---|---|---|---|---|
| F-001 | CRITICAL | NOT BUILT | **PARTIAL** | Gateway live at `/platform/`; not full commercial install/OAuth/OTLP |
| F-002 | CRITICAL | FAIL | **PARTIAL** | Public pages expanded; homepage still mixed identity |
| F-003 | CRITICAL | FAIL | **FAIL** | Installers still unsigned / quarantine instructions |
| F-004 | CRITICAL | FAIL | **FAIL** | No third-party audit |
| F-005 | CRITICAL | NOT BUILT | **NOT BUILT** | No KMS/rotation/revocation (passphrase + local Ed25519 only) |
| F-006 | CRITICAL | NOT BUILT | **PARTIAL** | Evidence Bundle V1 + QEV-PACKAGE-V1 implemented in platform |
| F-007 | HIGH | FAIL | **IN PROGRESS** | Integrity JSON exists but stale; verify page error HTML in source; re-sign + SSR fix |
| F-008 | HIGH | FAIL | **PARTIAL** | GitHub repo published; not full signed Releases for all binaries |
| F-009 | HIGH | FAIL | **FAIL** | Test counts still inconsistent on legacy pages |
| F-010 | HIGH | FAIL | **FAIL** | CLI dual package names still on public downloads |
| F-011 | HIGH | PARTIAL | **PARTIAL** | Version matrix not published as single generated page |
| F-012 | HIGH | FAIL | **FAIL** | Browser vault still 8-step technical UI |
| F-013 | HIGH | FAIL | **FAIL** | secret number / scramble code still exposed |
| F-014 | HIGH | FAIL | **PARTIAL** | Platform multi-verdict review exists; vault still JSON-heavy |
| F-015 | HIGH | FAIL BY DESIGN | **PARTIAL** | Personal vault irreversible OK; commercial multi-slot not done |
| F-016 | HIGH | FAIL | **FAIL** | Downloads “no servers” vs relay wording |
| F-017 | HIGH | FAIL | **FAIL** | Absolute safety language still possible on downloads |
| F-018 | HIGH | PARTIAL | **PARTIAL** | Platform uses Ed25519 package sigs; product demo still HMAC |
| F-019 | HIGH | NOT BUILT | **PARTIAL** | Queue, idempotency, DLQ, file-watch live; full provider suite not |
| F-020 | HIGH | NOT BUILT | **NOT BUILT** | No SSO / WebAuthn approval binding |
| F-021 | HIGH | NOT BUILT | **PARTIAL** | Shadow mode flag + stages documented; not long-running pilot |
| F-022 | HIGH | NOT VERIFIED | **NOT VERIFIED** | No published WCAG 2.2 AA evidence |
| F-023 | MEDIUM | PASS WITH GAPS | **PASS WITH GAPS** | Simulator = explainer only |
| F-024 | MEDIUM | FAIL | **FAIL** | Simulator Continue control (if still deployed) |
| F-025 | MEDIUM | PARTIAL | **PARTIAL** | Hit targets |
| F-026 | MEDIUM | PARTIAL | **PARTIAL** | Phrase entropy guidance |
| F-027 | MEDIUM | NOT VERIFIED | **PARTIAL** | robots/sitemaps/IndexNow/GSC submit done; Bing site auth incomplete |
| F-028 | MEDIUM | NOT BUILT | **NOT BUILT** | No status page / SLA / support bundle |

---

## What this means for AH Crap

| Question | Answer |
|---|---|
| Put live customer data into QEV commercial capture? | **No** |
| Use platform for synthetic / redacted historical? | **Yes, carefully (Gate C)** |
| Use browser vault for one-off secrets? | **Controlled preview only** |
| Issue QEV Protected badge? | **No** |

---

## Correct sequence (audit + our backlog)

1. **Gate A** — product identity, test matrix page, CLI name, integrity re-sign, claim cleanup  
2. **Gate B complete** — failure-injection suite green; install path without Terminal hacks for pilot appliance  
3. **Gate C** — redacted historical AH Crap jobs  
4. **Gate D** — shadow mode on live ops  
5. **Independent assessment + remediation**  
6. **Gate E** limited live automation  
7. **Gate F** Protected badge only after continuous checks  

The 136-case registry in `QEV_Master_Test_Cases.json` is the living suite target for CI.
