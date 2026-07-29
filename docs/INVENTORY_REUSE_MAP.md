# QEV Inventory & Reuse Map

**Date:** 2026-07-29  
**Purpose:** What exists today, what to lift into `qev-platform`, and what to leave alone.

---

## Public surfaces reviewed

| Surface | Role today | Commercial mapping |
|---|---|---|
| [secure.imagineqira.com](https://secure.imagineqira.com/) | Policy-aware envelope product preview (v0.29.0, 258 tests) | Marketing + evaluator path; must state **available vs planned** |
| [secure.imagineqira.com/vault](https://secure.imagineqira.com/vault) | Browser Vault V2 (XChaCha20-Poly1305 + Argon2id) | **Envelope core** — keep; do not overload with enterprise multi-GB records |
| [secure.imagineqira.com/downloads](https://secure.imagineqira.com/downloads) | Desktop / Qira Link / CLI downloads | Identity, pairing, Keychain — future device-key slots |
| [secure.imagineqira.com/app](https://secure.imagineqira.com/app/) | Live demo dashboard | Evaluator only — not the gateway |
| GitHub `TheArtOfSound/qev-desktop` | Source for desktop/web vault | Keep as envelope monorepo |
| Workflow simulators (Downloads HTML) | Product explainers | Stay simulators — never production connectors |

---

## Local repositories

### 1. `qev-desktop` — `/Users/bry/Documents/CLI/qev-desktop`

**Keep as:** Envelope Core

| Component | Reuse in platform? |
|---|---|
| `proof-lock-web` browser vault | Compatibility reference + format docs |
| `qev-cli` (`@bryan237l/qev-cli` v0.30.0) | **Rename plan** → `@imagineqira/qev-cli`; Vault V2 interop tests |
| Tauri desktop app | Viewer for Vault V2; later open `QEV-PACKAGE-V1` metadata |
| Landing / deploy scripts | Stay on public site deploy path |
| Tests + SECURITY.md / DISCLAIMER | Claims discipline |

**Do not:** turn this repo into the gateway or connector runtime.

### 2. `bry_nfet_sx` — `/Users/bry/dev/bry_nfet_sx`

Older/parallel tree of the same product family (Python package, dashboard, qira-link, CLI). Treat as historical / release sibling of desktop. Prefer **one** public envelope source of truth (`qev-desktop`).

### 3. `qev-evidence` — `/Users/bry/Downloads/qev-evidence`

**Role:** Guided dossier builder + independent verifier for `.qevpack` (model/file evidence meetings).

| Package | Reuse |
|---|---|
| `@qev/vault` | **Lifted** into `@imagineqira/qev-core` (Vault V2 noble impl) |
| `@qev/shared` canonical JSON + b64 | **Lifted** into `@imagineqira/qev-shared` |
| `@qev/signer` Ed25519 | Phase 2 — package/org signatures |
| `@qev/dossier` / builder / verifier UI | Parallel product story; **do not** merge as gateway. Optional later: “manual dossier” flow pack |
| hf-hub / mlbom | Domain-specific; out of platform core |

**Interop note:** Builder ↔ CLI Vault V2 PASS recorded in `interop/vault-cli-compatibility.json`. Platform must keep that compatibility.

### 4. `qev-model-intake` — `/Users/bry/Projects/qev-model-intake`

Simulator / intake harness. Remains explainer — not production gateway.

### 5. This repo — `/Users/bry/Projects/qev-platform` (**new**)

Commercial capture plane:

- gateway, SDKs, connectors, flow packs, evidence bundle V1, package seal, verifier CLI

---

## Crypto stack decision

| Layer | Algorithm | Status |
|---|---|---|
| Vault V2 content + wrap | **XChaCha20-Poly1305** + Argon2id | Available — browser, CLI, evidence, platform core |
| Policy session product (site demo) | **ChaCha20-Poly1305** (Python cryptography) | Available on secure.imagineqira.com product preview — **different surface** |
| Evidence Bundle integrity | SHA-256 over canonical JSON | Available in platform |
| Webhook auth | HMAC-SHA256 | Available in platform MVP |
| Org/connector signatures | Ed25519 (from qev-evidence signer) | Planned |
| KMS / HSM key slots | — | Planned; enterprise claim blocker |

**Public cleanup:** explain two AEAD choices as two product layers, or unify new commercial encryption path on XChaCha20-Poly1305 (Vault V2 family). Do **not** claim they are the same format.

---

## Package naming decision (recommended)

| Current | Target |
|---|---|
| `@bryan237l/qev-cli` | `@imagineqira/qev-cli` (deprecate old name with redirect docs) |
| `@qev/*` (evidence monorepo) | keep private or migrate to `@imagineqira/qev-evidence-*` |
| New platform packages | `@imagineqira/qev-*` as in this monorepo |

---

## What to lift vs reimplement

| Capability | Source | Platform action |
|---|---|---|
| Vault V2 encrypt/decrypt | qev-evidence vault / CLI | **Reuse algorithm** — done in `@imagineqira/qev-core` |
| Canonical JSON | qev-evidence shared | **Reuse** — done |
| Signed dossier `.qevpack` | qev-evidence | Separate format; optional bridge later |
| Gateway / OTLP / webhooks | nowhere production-ready | **New** — this repo |
| Flow packs | blueprint only | **New** YAML packs |
| Admin wizard | nowhere | **New** (stub README) |
| Device pairing / Keychain | qev-desktop / Qira Link | Later unlock slot types |

---

## Explicit non-goals for this repo

- Replace the browser one-off vault UX
- Require Qira-hosted plaintext
- Claim third-party audit completed
- Industry-specific codebases (use flow packs instead)
