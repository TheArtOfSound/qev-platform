# QEV Commercial Platform Blueprint

## Purpose

Turn the current QEV encrypted-envelope toolchain into a commercial product that can:

1. connect to real company systems without requiring every customer to build a custom integration;
2. capture observable evidence automatically;
3. preserve the existing local-first and portable-envelope values;
4. support dedicated workflows for AI, legal, software operations, vendor handoffs, investigations, and confidential approvals;
5. create a fixed, encrypted, independently checkable evidence package;
6. operate inside the customer's environment so sensitive plaintext does not need to pass through a Qira-hosted data plane;
7. remain honest about what the record proves and what it does not prove.

This document is a target architecture and implementation contract. It is not a claim that the commercial gateway, enterprise key management, or production connectors already exist.

---

# 1. What exists today

## 1.1 QEV local envelope core

The public QEV project already has useful building blocks:

- a portable `BRY-NFET-SX-VAULT-V2` envelope;
- XChaCha20-Poly1305 authenticated encryption;
- Argon2id phrase derivation;
- a random per-vault content key wrapped by a phrase-derived key;
- deterministic metadata binding through AEAD associated data;
- browser, CLI, desktop, and mobile-oriented surfaces;
- a JavaScript programmatic interface for encrypting and decrypting Vault V2;
- local/offline operation for the basic vault workflow;
- a published threat model and format documentation.

The content-key wrapping design is especially important. It means QEV can add new unlock methods later without replacing the underlying content-encryption key.

## 1.2 Policy and verification work

The public product site also describes:

- structured encrypted sessions;
- stored security artifacts;
- policy comparison;
- signed bundle verification;
- explicit separation of integrity, signature validity, metadata consistency, and overall trust;
- an Ed25519-signed site-integrity manifest;
- documented limitations such as no KMS/HSM integration, no key rotation or revocation, local trust assumptions, and no formal third-party security audit.

## 1.3 Desktop and pairing work

The download surface describes:

- Mac, Windows, Android, and CLI variants;
- device pairing;
- safety numbers;
- encrypted chat;
- Keychain-wrapped identity on Mac;
- identity backup and restore;
- cross-platform Vault V2 compatibility.

These are not separate dead ends. They can become identity, recipient-key, device-key, and verifier components of the commercial system.

---

# 2. The current problem: QEV is publicly split into several product stories

Today the public surfaces can be read as four products:

1. one-off offline secret vault;
2. policy-aware structured-message system;
3. paired-device encrypted chat;
4. future cross-system evidence connector.

The commercial version must present these as one stack.

## Required product hierarchy

### QEV Envelope Core

The cryptographic format, encryption libraries, file compatibility, CLI, desktop opening, and verification.

### QEV Capture Gateway

A customer-controlled local service that receives events from company systems, normalizes them, applies policy, builds evidence packages, and writes them to customer storage.

### QEV Connectors

Prebuilt adapters for webhooks, APIs, logs, OpenTelemetry, AI frameworks, identity systems, e-signature systems, document systems, and DevOps systems.

### QEV Flow Packs

Opinionated setup recipes for a specific business workflow. Flow packs are configurations and mappings, not separate products or separate codebases.

### QEV Verify

A browser, desktop, and CLI review surface that decrypts authorized packages, checks signatures and hashes, explains evidence gaps, and exports a readable investigation report.

### QEV Control Plane, optional

A Qira-hosted management service for licensing, connector updates, health status, policy distribution, and support. It must not require receiving customer plaintext.

---

# 3. The product principle

## One universal core, dedicated flows

Do not build a separate law-firm product, AI product, DevOps product, and vendor-handoff product.

Build one gateway and one evidence schema. Each dedicated workflow should define:

- systems to connect;
- events required;
- fields to capture;
- privacy mode for each field;
- identity source;
- artifact fingerprint rules;
- approval rules;
- package completion rule;
- retention rule;
- authorized recipients;
- review questions the package must answer.

A flow pack should be installable through a wizard and stored as versioned YAML.

---

# 4. Deployment architecture

## 4.1 Customer data plane

The QEV Gateway runs inside the customer's environment:

- Windows service;
- signed macOS/Linux binary;
- Docker Compose;
- Kubernetes Helm chart later;
- optional desktop appliance mode for small firms.

It receives evidence over local or customer-controlled connections and writes encrypted packages directly to customer-selected storage.

### Customer storage targets

Initial:

- local filesystem or network share;
- S3-compatible object storage;
- AWS S3;
- Azure Blob Storage;
- SharePoint document library;
- Google Drive folder through an authorized connector.

Later:

- immutable/WORM storage;
- legal-hold repositories;
- customer SIEM;
- customer archive platform.

## 4.2 Optional Qira control plane

The control plane may know:

- tenant ID;
- license;
- installed connector names and versions;
- health state;
- non-sensitive counts;
- update channel;
- support diagnostics approved by the customer.

It should not receive:

- prompts;
- documents;
- legal matter contents;
- decrypted evidence;
- customer encryption keys;
- connector secrets.

## 4.3 Three deployment modes

### Local appliance

Best for law firms and small companies.

- install QEV Gateway;
- open `https://localhost:7443`;
- choose a flow;
- connect systems;
- choose a folder;
- choose access policy;
- run a test;
- enable.

### VPC or server gateway

Best for AI and software teams.

- one container or binary;
- OTLP/webhook endpoint;
- customer KMS;
- object storage;
- optional SSO.

### Embedded SDK

Best for software products and agent platforms.

- JavaScript/TypeScript and Python first;
- direct event emission;
- automatic framework instrumentation;
- local gateway remains the destination.

---

# 5. Installation must be simple

## Standard customer setup target: under 15 minutes

1. Install or run one QEV Gateway package.
2. Open the local admin page.
3. Select a flow pack.
4. Sign in to each supported system through OAuth or paste a limited-scope service credential.
5. QEV tests each connection and shows exactly what data it can read.
6. Map the system's user IDs to the company's identity source.
7. Select storage.
8. Select unlock methods.
9. Run one simulated event.
10. Review the draft evidence package.
11. Enable the flow.

## No-code standard connector rule

A standard connector must not require the customer to:

- write code;
- edit JSON manually;
- build a webhook receiver;
- manage a database;
- understand QEV's internal vault schema;
- create a custom encryption pipeline.

## Low-code custom connector rule

A custom connector should require only one of:

- send a signed webhook to the gateway;
- send OTLP logs/spans;
- call `qev.capture()` from an SDK;
- map an existing JSON log through a visual field mapper.

---

# 6. Ingestion architecture

The gateway needs six input paths.

## 6.1 Signed webhook receiver

For SaaS platforms such as legal systems, e-signature, ticketing, and approval tools.

Responsibilities:

- verify provider signature;
- preserve raw body hash;
- deduplicate deliveries;
- retry enrichment API calls;
- record provider event ID;
- normalize to `qev.event.v1`.

## 6.2 OpenTelemetry receiver

This should be the universal path for instrumented applications, AI agents, HTTP services, databases, and CI/CD.

The QEV Gateway should accept:

- OTLP/HTTP;
- OTLP/gRPC;
- logs;
- spans;
- trace relationships;
- GenAI semantic attributes where available.

The gateway should not replace observability. It should select completed high-value traces and turn them into fixed evidence packages.

## 6.3 Log collector

For systems with no webhook.

Initial support:

- JSON line files;
- Windows Event Log;
- syslog;
- CloudWatch export;
- Azure Event Hub;
- S3 object notification;
- watched folders.

## 6.4 API poller

For systems that provide APIs but no reliable push event.

Requirements:

- incremental cursor;
- ETag/version support;
- overlap window;
- backoff;
- idempotent upsert;
- explicit missed-poll health warning.

## 6.5 Policy proxy

For high-risk actions.

The action passes through the QEV Gateway before reaching the target.

Examples:

- production database command;
- AI tool call;
- deployment;
- payment approval;
- access grant;
- document release.

The proxy can:

- allow;
- allow and record;
- pause for approval;
- require extra evidence;
- block;
- send to an existing approval tool.

## 6.6 SDK

For software the customer owns.

The SDK should offer:

- a low-level event method;
- a workflow context manager;
- automatic HTTP and AI instrumentation;
- artifact hashing;
- human approval hooks;
- local buffering when the gateway is offline.

---

# 7. Canonical event model

Every connector converts vendor-specific data into `qev.event.v1`.

Required concepts:

- unique event ID;
- occurred time;
- observed time;
- tenant and flow;
- case/run/matter correlation ID;
- source system and connector version;
- raw event hash;
- actor identity and authentication context;
- action;
- target;
- outcome;
- artifacts and fingerprints;
- policy decision;
- privacy classification;
- connector signature;
- ingestion sequence;
- known gaps.

## Privacy modes per field

Every field must support one of:

- `full`: encrypted plaintext included;
- `redacted`: transformed value included;
- `hash_only`: only a fingerprint included;
- `reference_only`: external object ID and version included;
- `drop`: never included.

This is essential for legal confidentiality and AI prompts.

---

# 8. Evidence package evolution

## 8.1 Do not break Vault V2

`BRY-NFET-SX-VAULT-V2` should continue opening in every current QEV surface.

Do not silently repurpose it into a multi-gigabyte enterprise archive.

## 8.2 Add QEV Evidence Bundle V1

Suggested container:

`QEV-EVIDENCE-BUNDLE-V1`

It should contain:

- canonical manifest;
- normalized event stream;
- package summary;
- policy decisions;
- source and connector versions;
- known evidence gaps;
- artifact references;
- encrypted attachment chunks where selected;
- connector signatures;
- package signature;
- unlock key slots;
- retention and access policy;
- verification results.

## 8.3 Large artifacts

The current browser vault is suitable for small payloads. Enterprise evidence needs large files.

Use:

- per-bundle random data-encryption key;
- authenticated streaming encryption for files;
- encrypted chunks;
- hash tree or ordered chunk manifest;
- final authenticated stream marker;
- artifact size and media type;
- optional external encrypted blob reference.

Do not load a multi-gigabyte discovery export into browser memory.

## 8.4 Key slots

The bundle data key should be wrappable through several independent unlock paths:

- passphrase slot using Argon2id;
- recipient public-key slot;
- organization KMS slot;
- device-bound key slot;
- recovery escrow slot;
- time-limited external-review slot.

Adding or removing a slot should rewrap the data key, not re-encrypt the entire package.

## 8.5 Signatures

Use asymmetric signatures for:

- connector identity;
- package issuer;
- human approval;
- cross-company handoff.

HMAC can remain useful inside a local system, but a third party cannot independently attribute an HMAC to one organization because verification requires the same secret.

Suggested signature model:

- Ed25519 connector key;
- Ed25519 organization/package key;
- optional WebAuthn/passkey-backed human approval assertion;
- customer certificate or KMS signing later.

## 8.6 Time

A local timestamp is evidence of what the local system said, not independent proof of global time.

Support levels:

1. local connector time;
2. gateway receipt time;
3. organization-signed time;
4. optional trusted timestamp service or external transparency anchor.

Do not claim independent time proof unless level 4 is used.

---

# 9. Identity architecture

## Sources

- Microsoft Entra ID;
- Okta;
- Google Workspace;
- local directory;
- application-specific identity;
- device identity;
- service account identity.

## Actor record

Capture:

- stable subject ID;
- provider;
- display value;
- role;
- authentication method if exposed;
- session ID;
- device ID if available;
- source IP only as context;
- location only as a risk signal;
- approval credential.

IP, GPS location, or download time must never be the main decryption secret. They are unstable and can be spoofed or unavailable.

## Human approval

A human decision should record:

- approver identity;
- decision;
- scope;
- reason;
- exact artifact or action hash approved;
- policy version;
- time;
- approval signature or source assertion.

---

# 10. Dedicated flow packs

# 10.1 AI Agent Evidence Flow

## Goal

Preserve the observable execution of an AI workflow and optionally stop high-risk tool actions.

## Connectors

Initial:

- QEV JavaScript SDK;
- QEV Python SDK;
- OpenTelemetry OTLP;
- OpenAI Agents trace processor;
- generic OpenAI-compatible HTTP proxy;
- AWS Bedrock invocation-log reader;
- AWS CloudTrail reader;
- Microsoft Copilot interaction export reader;
- MCP tool proxy;
- LangChain callback adapter later.

## Capture

- requesting user;
- application and agent ID;
- model provider and model/deployment ID;
- prompt in selected privacy mode;
- prompt template/version;
- system instructions hash;
- retrieved source IDs, versions, passages, and hashes where exposed;
- tool name;
- tool arguments in selected privacy mode;
- tool result;
- guardrail result;
- handoff;
- human approval;
- output;
- token usage;
- errors and retries;
- final action result.

## Do not capture or claim

- hidden chain-of-thought;
- provider-internal reasoning not exposed through an API;
- data that the platform did not emit;
- independent truth of the model's claims.

## Policy examples

- block file deletion outside a sandbox;
- require approval for outbound email;
- require a source for legal or financial claims;
- hash prompts instead of storing text;
- store full output only in the encrypted package;
- prevent an agent from invoking production tools.

## Easy setup

### OpenAI Agents

Install one package and register a QEV trace processor.

### OpenTelemetry-ready application

Set the OTLP endpoint to the QEV Gateway and select the AI flow pack.

### AWS

Choose the AWS flow. The wizard creates or imports least-privilege access to CloudWatch, S3, and CloudTrail.

### Unsupported agent

Run through the local QEV HTTP/MCP proxy or send generic webhooks.

---

# 10.2 Legal Engagement and Agreement Flow

## Goal

Preserve an exact agreement history across intake, editing, signature, and matter storage.

## Initial systems

- Clio Manage;
- Microsoft 365/SharePoint;
- DocuSign or equivalent e-signature;
- optional Outlook matter mailbox;
- local folder watcher for smaller firms.

## Capture

- matter ID;
- client ID;
- intake form version;
- submitted values;
- document version and ETag;
- staff editor;
- field-level or document-level change;
- approval;
- signer;
- signature provider event;
- final file fingerprint;
- final storage path and version;
- known missing evidence.

## Privacy defaults

- local customer gateway;
- customer storage;
- no plaintext to Qira;
- matter-level package key;
- full content restricted to approved legal roles;
- operational metadata visible without opening content;
- optional hash-only email subject and recipient;
- explicit legal-hold setting;
- external counsel review slot;
- complete access log.

## Dedicated legal workflows

- engagement agreement;
- settlement approval;
- client evidence intake;
- expert report approval;
- discovery production handoff;
- litigation hold snapshot;
- privileged internal investigation.

## Important boundary

QEV can preserve confidentiality controls and evidence. It does not itself create attorney-client privilege, satisfy every ethics rule, or guarantee admissibility.

---

# 10.3 DevOps Change Flow

## Goal

Create a complete evidence record for a high-risk software or infrastructure change.

## Systems

- GitHub/GitLab/Azure DevOps;
- CI/CD tool;
- identity provider;
- ticket/change-management tool;
- backup service;
- cloud audit logs;
- database audit;
- deployment target.

## Capture

- actor;
- ticket;
- commit SHA;
- pull request;
- reviewed diff hash;
- build;
- tests;
- environment;
- command or plan;
- backup status;
- approver;
- deployment result;
- rollback;
- affected resources.

## Gate examples

- production deletion;
- infrastructure destroy;
- unreviewed deployment;
- database migration without backup;
- permission escalation;
- secret export.

---

# 10.4 Vendor Handoff Flow

## Goal

Give a customer a private package proving exactly what was delivered without exposing the vendor's entire internal system.

## Capture

- contract/work item;
- engineer;
- approved deliverable list;
- final artifact hashes;
- scan/test result;
- client approval;
- approved hash;
- delivery channel;
- receipt.

## Package behavior

- internal evidence remains excluded;
- client gets a recipient key slot;
- vendor signs the package;
- client verifies signature and artifact hashes;
- changing the file after approval invalidates the approval relationship.

---

# 10.5 Confidential Investigation Flow

## Goal

Preserve evidence while restricting broad administrator access.

## Capture

- case ID;
- custodian;
- acquisition source;
- artifact hash;
- investigator action;
- review decision;
- access attempt;
- export.

## Controls

- dual control;
- two-person open;
- matter/case key;
- recovery trustee;
- legal hold;
- no indexing of plaintext;
- metadata-only admin surface;
- audit of every unlock attempt.

---

# 11. SDK design

## JavaScript/TypeScript package

Suggested package names:

- `@imagineqira/qev-core`
- `@imagineqira/qev-sdk`
- `@imagineqira/qev-otel`
- `@imagineqira/qev-connectors`
- `@imagineqira/qev-cli`

Do not keep two public CLI package names.

## Minimal use

```ts
import { QEV } from "@imagineqira/qev-sdk";

const qev = new QEV({
  endpoint: "https://qev-gateway.internal:7443",
  token: process.env.QEV_INGEST_TOKEN!,
});

await qev.capture({
  flow: "vendor-handoff",
  caseId: "delivery-1842",
  type: "artifact.delivered",
  actor: { id: "sam@vendor.example" },
  artifact: await qev.file("./access-policy-v7.yaml"),
});
```

## Workflow context

```ts
await qev.workflow(
  {
    flow: "production-change",
    caseId: changeTicket,
    actor: currentUser,
  },
  async (run) => {
    await run.record("change.requested", request);

    const decision = await run.policy("production-database-change", request);
    if (decision.effect === "block") {
      throw new Error(decision.reason);
    }

    const result = await executeChange();
    await run.record("change.completed", result);
    await run.complete();
  }
);
```

## Python

Equivalent API:

```python
from qev import QEV

qev = QEV(endpoint="https://qev-gateway.internal:7443")

with qev.workflow(
    flow="ai-agent-run",
    case_id=trace_id,
    actor={"id": user_id},
) as run:
    run.record("agent.prompt", prompt, privacy="hash_only")
    run.record("agent.tool_call", tool_call)
    run.complete(output=answer)
```

## Reliability

SDK requirements:

- local disk queue;
- idempotency key;
- batching;
- retries with jitter;
- explicit flush;
- bounded memory;
- no sensitive logging;
- no silent event dropping;
- health callback;
- event receipt from gateway.

---

# 12. Connector SDK

A connector package must implement:

```ts
interface QEVConnector {
  manifest(): ConnectorManifest;
  authorize(input: AuthorizationInput): Promise<AuthorizationResult>;
  test(): Promise<ConnectionTest>;
  subscribe(): Promise<SubscriptionState>;
  backfill(cursor?: string): AsyncIterable<RawProviderEvent>;
  normalize(raw: RawProviderEvent): Promise<QEVEvent[]>;
  enrich(event: QEVEvent): Promise<QEVEvent>;
  health(): Promise<ConnectorHealth>;
  close(): Promise<void>;
}
```

## Connector manifest

- name;
- version;
- vendor;
- supported regions;
- permissions;
- event types;
- privacy warning;
- webhook/poll/log mode;
- credential type;
- setup steps;
- required outbound hosts;
- data fields;
- rate limits;
- backfill support.

## Connector security

- least-privilege scopes;
- secrets encrypted with customer key;
- no secret in logs;
- webhook signature verification;
- TLS;
- outbound allowlist;
- connector-specific sandbox;
- signed connector package;
- version pinning;
- revocation.

---

# 13. Gateway API

Initial endpoints:

- `POST /v1/events`
- `POST /v1/events/batch`
- `POST /v1/artifacts/hash`
- `POST /v1/flows/{flow_id}/complete`
- `POST /v1/policy/evaluate`
- `POST /v1/approvals`
- `GET /v1/receipts/{event_id}`
- `GET /v1/packages/{package_id}`
- `POST /v1/packages/{package_id}/rewrap`
- `POST /v1/packages/{package_id}/verify`
- `GET /healthz`
- `GET /readyz`

---

# 14. Admin experience

## Pages

- Overview;
- flows;
- connectors;
- evidence mapping;
- privacy mapping;
- identities;
- policies;
- approvals;
- storage;
- keys;
- packages;
- verification;
- health;
- updates;
- audit.

## Must show

- which source supplied each fact;
- what is missing;
- whether data is full, redacted, hash-only, or external;
- whether identity is asserted, signed, or merely labeled;
- whether time is local or independently anchored;
- whether the package is encrypted;
- whether the package signature is valid;
- whether package contents changed;
- whether the source event was authenticated;
- whether a connector is stale or disconnected.

---

# 15. Security work required before enterprise claims

## Must-have

- third-party cryptographic and application security review;
- signed release artifacts;
- Apple notarization;
- Windows Authenticode signing;
- software bill of materials;
- dependency pinning and provenance;
- reproducible or attestable builds;
- KMS/HSM support;
- key rotation;
- recipient revocation strategy;
- recovery design;
- signed connector packages;
- tenant isolation;
- Windows-safe concurrency;
- NFS/object-storage-safe package writing;
- secure update channel;
- backup and restore;
- disaster recovery;
- rate limits and denial-of-service controls;
- fuzzing of parsers and vault formats;
- migration tests across every QEV surface;
- package-size and stream-failure tests.

## Commercial legal and policy work

- data processing agreement;
- privacy policy for control-plane metadata;
- security white paper;
- subprocessors list;
- support and incident process;
- retention and deletion commitments;
- customer responsibility matrix;
- industry-specific claims reviewed by counsel.

---

# 16. Public cleanup required now

## One product statement

Use:

> QEV is a local-first encrypted evidence platform. Its envelope core protects portable records; its gateway and connectors capture selected evidence from real workflows before sealing it for later review.

## Compatibility table

Publish one table covering:

- web vault version;
- desktop version;
- Android version;
- CLI version;
- Vault V2 read/write support;
- Evidence Bundle V1 support;
- signatures;
- large attachments;
- key slots.

## Resolve inconsistencies

- choose one CLI package name;
- explain why the policy system uses ChaCha20-Poly1305 while Vault V2 uses XChaCha20-Poly1305, or unify the new commercial core;
- explain the relationship between test counts;
- separate “available today” from “target architecture”;
- replace every broad “proof” claim with the exact property verified;
- make the connector architecture visible on the main site;
- link the simulator as a simulator, not the product;
- clearly mark the current formal-audit status.

---

# 17. Repository strategy

## Keep

### `qev-desktop`

Purpose:

- envelope core;
- browser tool;
- desktop/mobile clients;
- CLI;
- verifier;
- Vault V2 compatibility.

## Create

### `qev-platform`

Purpose:

- gateway;
- SDKs;
- event schema;
- connector runtime;
- policy engine;
- package builder;
- admin UI;
- flow packs;
- deployment.

Suggested monorepo:

```text
qev-platform/
├── apps/
│   ├── gateway/
│   ├── admin/
│   └── verifier/
├── packages/
│   ├── event-schema/
│   ├── evidence-bundle/
│   ├── sdk-js/
│   ├── sdk-python/
│   ├── connector-sdk/
│   ├── policy-engine/
│   └── otel-qev/
├── connectors/
│   ├── generic-webhook/
│   ├── otlp/
│   ├── openai-agents/
│   ├── aws-bedrock/
│   ├── microsoft-graph/
│   ├── clio/
│   ├── docusign/
│   ├── github/
│   └── file-watch/
├── flows/
│   ├── ai-agent/
│   ├── legal-engagement/
│   ├── devops-change/
│   ├── vendor-handoff/
│   └── investigation/
├── deploy/
│   ├── docker/
│   ├── windows/
│   ├── macos/
│   └── helm/
├── schemas/
├── docs/
└── tests/
```

## Demo repository

The model-intake/simulator repository should remain a product explainer and test harness. It should not become the production gateway codebase.

---

# 18. Licensing and commercial model

Recommended open-core structure:

- Vault format: public;
- event schema: public;
- verification libraries: public;
- basic SDK: public;
- generic webhook and OTLP connectors: public;
- local single-node gateway: public or community edition;
- enterprise SSO/KMS, managed connector catalog, policy packs, support, control plane, and compliance features: commercial.

The exact license and trademark structure should be reviewed by counsel before release.

---

# 19. Recommended first build

Do not build ten connectors at once.

## First commercial vertical

AI agent or DevOps workflow in a controlled environment.

Reason:

- event sources are technically accessible;
- the customer can run in staging;
- policy effects are measurable;
- no legal claim of privilege;
- the same OTLP/proxy/SDK foundation can serve both.

## First connector set

1. generic signed webhook;
2. OTLP receiver;
3. JavaScript SDK;
4. Python SDK;
5. OpenAI Agents trace processor;
6. GitHub connector;
7. local file/artifact watcher;
8. S3/Azure/local storage.

## First flow pack

Production software change:

- identity;
- change request;
- commit;
- tests;
- environment;
- backup;
- approval;
- execution;
- result;
- sealed package.

## Second vertical

Legal agreement history using:

- Clio;
- Microsoft 365/SharePoint;
- one e-signature provider.

---

# 20. Build phases

## Phase 0 — Unify and freeze contracts

- choose names;
- publish product architecture;
- freeze `qev.event.v1`;
- freeze `QEV-EVIDENCE-BUNDLE-V1`;
- create compatibility tests;
- resolve CLI naming;
- document available vs planned.

## Phase 1 — Local gateway MVP

- signed webhook;
- OTLP;
- file watcher;
- local encrypted storage;
- package builder;
- verifier;
- Docker and desktop installer;
- admin wizard;
- JS SDK.

## Phase 2 — First real workflow

- GitHub;
- identity;
- CI/CD;
- approval;
- database/deployment result;
- staging pilot;
- metrics.

## Phase 3 — Enterprise key and identity

- Entra/Okta;
- KMS;
- recipient keys;
- rotation;
- rewrap;
- revocation;
- signed approvals;
- package signatures.

## Phase 4 — AI pack

- OpenAI Agents;
- Bedrock;
- CloudTrail;
- MCP proxy;
- GenAI/OTel mappings;
- prompt privacy modes;
- high-risk tool gate.

## Phase 5 — Legal pack

- Clio;
- Microsoft Graph;
- e-signature;
- matter-level access;
- legal hold;
- external counsel slot;
- confidentiality review.

## Phase 6 — Audit and commercial release

- external audit;
- installer signing;
- support process;
- pilot evidence;
- pricing;
- commercial contracts.

---

# 21. Acceptance criteria

The product is not ready to call a real connector platform until all of these are true:

1. A standard customer installs it without writing code.
2. At least one real external system sends events automatically.
3. Webhook authenticity is verified.
4. Duplicate and out-of-order events are handled.
5. The package identifies every evidence source.
6. Missing evidence is visible.
7. A completed workflow seals automatically.
8. Live workflow changes do not rewrite a sealed package.
9. A package opens in browser, desktop, and CLI where intended.
10. A changed package or extracted record fails verification.
11. A recipient can be added by rewrapping the data key.
12. A key can be rotated.
13. Customer plaintext can remain inside the customer's environment.
14. Large files stream without loading entirely into memory.
15. Failed connectors generate health alerts.
16. No event is silently dropped.
17. An investigator can answer a defined set of questions from the package.
18. Security claims match the exact implemented trust model.
19. A third party has reviewed the cryptographic and application design.
20. A real pilot customer says the package solved a reconstruction, sharing, or confidentiality problem better than its existing logs.

---

# 22. What not to build

- a separate codebase for every industry;
- a cloud collector that requires customer plaintext;
- a dashboard that merely copies existing logs;
- a claim to capture hidden AI reasoning;
- blockchain unless a customer requirement proves it necessary;
- IP address or location as the main encryption key;
- custom cryptography;
- an SDK that requires developers to manually record every ordinary event;
- integrations based only on brittle browser scraping;
- commercial claims before key management, installer signing, and external review are addressed.

---

# 23. Immediate decision

The next repository should be `qev-platform`, not another simulator.

The first implementation milestone should be:

> A customer-controlled QEV Gateway receives a real signed webhook or OTLP trace, normalizes the event, binds identity and artifact hashes, applies a versioned policy, automatically creates a QEV Evidence Bundle V1, encrypts it through the existing content-key model, writes it to customer storage, and verifies it in the existing QEV viewer.

That is the smallest build that proves QEV has evolved from an encrypted file tool into a real commercial evidence platform.
