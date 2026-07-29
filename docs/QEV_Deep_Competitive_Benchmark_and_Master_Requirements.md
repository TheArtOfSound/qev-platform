# QEV Deep Competitive Benchmark and Master Product Requirements

**Date:** July 29, 2026  
**Purpose:** Define the full product architecture and build gates required to turn QEV from a controlled encrypted-envelope preview into a streamlined commercial evidence platform for small businesses, AI builders, legal teams, software teams, and regulated organizations.

---

## 1. Verdict

The existing QEV commercial blueprint is a useful foundation, but it is not yet “absolutely everything.”

The missing work is not primarily more encryption. It is the operating system around the encrypted envelope:

- reliable connector authorization and lifecycle management;
- a durable event pipeline;
- event deduplication, replay defense, ordering, backfill, and schema migration;
- a trust model that separates source authentication, content integrity, identity, time, completeness, and truth;
- enterprise key lifecycle and revocation;
- immutable storage and legal hold;
- AI-specific trace privacy, evaluation references, and prompt/model versioning;
- legal evidence certifications and chain-of-custody reports;
- safe signed installers and update infrastructure;
- connector certification and continuous health;
- a no-code setup wizard;
- a shadow-mode testing system;
- industry flow packs built on one universal platform;
- a clear boundary between what QEV builds itself and what it should integrate from established systems.

No product can be made “perfect” before real use. The correct target is:

> A complete, testable, standards-based platform foundation that can be piloted without inventing core architecture during the pilot.

---

# 2. What QEV should uniquely own

QEV should not try to replace Zapier, Nango, Workato, Temporal, OpenTelemetry, Vanta, DocuSign, Microsoft Purview, HashiCorp Vault, AWS KMS, or cloud object storage.

QEV should own the part those systems do not combine into one product:

1. Select evidence from several systems.
2. Normalize it into one portable evidence model.
3. Bind each fact to its source, identity strength, artifact fingerprint, policy version, and capture method.
4. State explicitly what was not captured.
5. Freeze the exact workflow record.
6. Encrypt it under customer-controlled access paths.
7. Sign it with independently verifiable identities.
8. Optionally anchor time and append-only history.
9. Store it in customer-selected storage.
10. Open and verify it without requiring the original vendor account.
11. Produce an understandable review and certification packet.

This is the defensible product center.

---

# 3. Product layers

## 3.1 QEV Envelope Core

The existing portable encrypted-envelope and vault functionality.

Responsibilities:

- payload encryption;
- content-key wrapping;
- passphrase unlock;
- local opening;
- format parsing;
- integrity checking;
- cross-platform compatibility;
- backward compatibility with Vault V2.

## 3.2 QEV Gateway

A customer-controlled local or VPC service.

Responsibilities:

- receive events;
- verify source signatures;
- deduplicate and sequence events;
- buffer while offline;
- normalize data;
- enforce privacy mappings;
- apply policies;
- request approval;
- hash artifacts;
- create evidence packages;
- sign packages;
- encrypt packages;
- write to customer storage;
- report health.

## 3.3 QEV Connector Runtime

The shared infrastructure every connector needs:

- OAuth and API-key authorization;
- secure credential storage;
- refresh-token lifecycle;
- least-privilege scopes;
- webhook receipt and signature verification;
- scheduled polling;
- pagination;
- backfill cursors;
- retries and rate-limit handling;
- checkpoints;
- schema mapping;
- connector logs;
- per-tenant isolation;
- version pinning;
- connector updates;
- test and production environments;
- connection health.

## 3.4 QEV Flow Packs

No-code workflow definitions for a particular business process.

Examples:

- Field Service Job Evidence;
- AI Agent Evidence;
- Production Change Evidence;
- Legal Engagement Agreement;
- Vendor Handoff;
- Confidential Investigation.

## 3.5 QEV Verify

Browser, desktop, and CLI review.

It must independently explain:

- package integrity;
- package signature;
- connector signatures;
- source webhook authenticity;
- identity strength;
- timestamp strength;
- artifact matches;
- evidence completeness;
- known gaps;
- policy results;
- changes after sealing;
- unsupported claims.

## 3.6 Optional QEV Control Plane

Qira-hosted management without customer plaintext.

Permitted data:

- tenant identifier;
- license;
- connector names and versions;
- health;
- non-sensitive counts;
- update channel;
- approved diagnostics.

Prohibited by default:

- prompts;
- legal documents;
- job photos;
- customer files;
- decrypted evidence;
- package content keys;
- connector credentials.

---

# 4. What to learn from integration companies

## 4.1 Nango pattern: authorization and connector runtime

Nango’s product model separates user authorization from provider-specific integration functions. It handles OAuth, token refresh, scoped credentials, retries, rate limits, schedules, webhooks, checkpoints, observability, environments, and tenant isolation.

### QEV requirement

QEV needs an equivalent connection object:

```text
Connection
- tenant_id
- provider
- connection_id
- authorization_type
- granted_scopes
- credential_reference
- created_at
- last_refresh_at
- last_success_at
- health
- environment
- region
- connector_version
```

The QEV admin should never expose raw OAuth refresh tokens after setup.

### Build-or-partner decision

Do not build support for hundreds of OAuth providers first.

Evaluate three options:

1. embed or self-host a mature authorization layer such as Nango;
2. use a comparable integration-auth service;
3. build a limited QEV auth broker only for the first five providers.

The decision must include licensing, self-hosting, credential custody, tenant isolation, exportability, and failure behavior.

## 4.2 Workato pattern: trigger, actions, recipes, and error UX

Workato separates:

- connections;
- triggers;
- actions;
- recipes;
- conditional steps;
- loops;
- retries;
- error handling;
- job history.

### QEV adaptation

A QEV flow should have:

- triggers that start or update a case;
- evidence-read actions;
- optional write/gate actions;
- conditions;
- human approval steps;
- completion rules;
- fallback paths;
- explicit error branches.

Every connector error must be understandable to a nondeveloper:

Bad:

```text
401 invalid_grant
```

Required:

```text
Google Drive access expired.
No evidence has been collected from Drive since July 28 at 2:14 PM.
Reconnect the account. Existing sealed packages are unaffected.
```

## 4.3 Vanta and Drata pattern: automated plus manual evidence

Compliance platforms use connections for continuous evidence but still support manually uploaded evidence, attestations, owners, tests, findings, and remediation.

### QEV adaptation

Every required evidence item needs one status:

- automatically captured;
- manually supplied;
- attested by a person;
- externally referenced;
- intentionally excluded;
- unavailable;
- stale;
- missing.

A flow cannot show one generic “complete” percentage without distinguishing these states.

Each evidence requirement also needs:

- owner;
- due time;
- source;
- freshness rule;
- accepted capture modes;
- remediation instruction;
- exception reason;
- exception approver;
- expiration date for the exception.

---

# 5. Standards for the event layer

## 5.1 CloudEvents

Use CloudEvents as the transport envelope or align closely with it.

Core fields should include:

- `id`;
- `source`;
- `specversion`;
- `type`;
- `subject`;
- `time`;
- `datacontenttype`;
- `dataschema`;
- `data`.

### QEV extensions

Add QEV-specific extensions:

- `qevtenant`;
- `qevflow`;
- `qevcase`;
- `qevprivacy`;
- `qevconnector`;
- `qevrawhash`;
- `qevidentity`;
- `qevpolicy`;
- `qevgaps`.

Do not create a needlessly incompatible event envelope when a vendor-neutral standard already exists.

## 5.2 AsyncAPI

Every event connector should publish an AsyncAPI contract describing:

- channels;
- messages;
- send/receive operations;
- authentication;
- protocol binding;
- schema versions;
- examples.

This enables generated documentation, test fixtures, and compatibility checks.

## 5.3 JSON canonicalization

Use RFC 8785 JSON Canonicalization Scheme before hashing or signing JSON objects.

Do not rely on ordinary `JSON.stringify()` behavior across languages and versions.

## 5.4 Schema registry

QEV needs a real schema lifecycle:

- immutable schema versions;
- backward-compatible additions;
- explicit breaking versions;
- migration tools;
- old-event readers;
- golden test vectors;
- connector-to-schema compatibility matrix;
- package manifest listing every schema version used.

---

# 6. Connector reliability requirements

Stripe’s webhook guidance provides the correct minimum behavior for any production connector.

## 6.1 Source verification

- preserve the exact raw request bytes;
- verify provider signature before parsing;
- record signature algorithm and key identifier;
- enforce a replay window where supported;
- record verification success or failure;
- never label an unverified event as provider-authenticated.

## 6.2 Fast acknowledgement

The receiver should:

1. verify enough to reject obvious invalid input;
2. durably queue the event;
3. return success quickly;
4. perform enrichment and package work asynchronously.

## 6.3 Duplicates

Assume duplicate delivery.

Use a unique constraint over a provider-specific identity such as:

```text
tenant + provider + provider_event_id
```

Also support logical deduplication when a provider emits two event objects for one underlying change.

## 6.4 Out-of-order delivery

Assume events can arrive out of order.

The gateway needs:

- occurrence time;
- observed time;
- provider sequence where available;
- gateway sequence;
- causal parent;
- reconciliation state;
- late-event handling.

A sealed package must define whether late evidence:

- creates a supplemental package;
- creates a superseding version;
- remains excluded;
- requires human review.

It must never silently rewrite the sealed package.

## 6.5 Retry and dead-letter behavior

Every failed event needs:

- attempt count;
- next retry;
- last error;
- retry classification;
- dead-letter reason;
- manual replay;
- evidence-gap impact.

No event may disappear silently.

## 6.6 Backfill

Every connector must declare:

- earliest retrievable date;
- cursor type;
- deletion visibility;
- pagination behavior;
- rate limits;
- expected lag;
- backfill completeness;
- whether historical webhook signatures remain available.

## 6.7 Version migration

Connector upgrades should support shadow mode:

- old and new connector run together;
- only one writes authoritative events;
- outputs are compared;
- duplicates are suppressed;
- divergence is reported;
- rollback remains possible.

---

# 7. Durable workflow engine

Do not implement important workflow state as a collection of browser callbacks and timers.

Use a durable execution engine or a durable queue/state-machine architecture so a workflow resumes after:

- reboot;
- process crash;
- expired token;
- network outage;
- storage outage;
- delayed human approval;
- days or months of inactivity.

QEV workflows need:

- deterministic state transitions;
- versioned workflow definitions;
- compensating actions;
- timeouts;
- cancellation;
- human signals;
- retry policies;
- immutable history;
- migration rules.

A mature durable engine such as Temporal should be evaluated before building this infrastructure from scratch.

---

# 8. Integrity and append-only design

## 8.1 Borrow from AWS CloudTrail digest chaining

CloudTrail creates hashes of log files, signs digest files, and links each digest to the previous digest. It can also issue an empty digest for a period with no activity.

### QEV adaptation

The QEV Gateway should produce periodic signed checkpoints:

```text
Checkpoint
- tenant
- stream
- interval_start
- interval_end
- first_sequence
- last_sequence
- event_count
- event_merkle_root
- previous_checkpoint_hash
- known_delivery_gaps
- signer
- signature
```

Create checkpoints even when no event occurred, when the customer needs evidence of continuous recorder operation.

This gives QEV a way to detect deletion of intermediate records—not only modification of a final package.

## 8.2 Borrow from immudb

An append-only verified store can protect gateway event history before package sealing.

Options:

- embed an append-only cryptographic ledger;
- integrate immudb;
- use an ordinary database plus signed hash-chain checkpoints;
- store checkpoints in immutable object storage.

The verifier must not require trusting only the same server that stored the evidence.

## 8.3 Borrow from Sigstore bundles and transparency logs

A verification bundle should include the material needed for offline verification:

- artifact digest;
- signature;
- signer certificate or public key reference;
- timestamp proof;
- transparency inclusion proof where used;
- trust-root version.

For confidential QEV packages, do not publish evidence or identifying metadata to a public log.

Possible modes:

- no external anchor;
- customer-private transparency log;
- hash-only public anchor;
- RFC 3161 timestamp;
- cross-organization witness.

The UI must explain which mode was used.

---

# 9. Time model

A timestamp field alone is not trusted time.

QEV should expose four levels:

1. **Source asserted** — the source system reported the time.
2. **Gateway observed** — the QEV Gateway received it at this time.
3. **Organization signed** — the company signed a checkpoint containing it.
4. **Externally anchored** — a trusted timestamp authority or external witness anchored the digest.

RFC 3161 should be supported for proof that a digest existed before a stated time.

Do not describe source time or gateway time as independent proof of time.

---

# 10. Key management

## 10.1 Envelope encryption

Keep one random content-encryption key per package.

Wrap that key using one or more slots:

- passphrase slot;
- user public-key slot;
- organization KMS slot;
- device slot;
- recovery slot;
- temporary reviewer slot.

## 10.2 Borrow from HashiCorp Vault Transit

Required operations:

- generate data key;
- encrypt;
- decrypt;
- sign;
- verify;
- rotate master key;
- rewrap data key;
- report key version.

## 10.3 Borrow from AWS KMS

Key rotation and data-key rotation are different.

Rotating a KMS key does not automatically rotate or re-encrypt the package data keys already protected by it.

QEV needs explicit jobs for:

- key-slot rewrap;
- package-key rotation where required;
- compromised-key response;
- cryptographic erasure;
- stale-key reporting.

## 10.4 Borrow from Slack EKM and Box KeySafe

Enterprise customers expect:

- customer-owned keys;
- visibility into every unwrap/decrypt operation;
- granular key access;
- a kill switch;
- minimal interruption to unaffected data.

QEV key policy should support scope by:

- tenant;
- workspace;
- flow;
- matter;
- case;
- package;
- recipient;
- time range.

## 10.5 Revocation boundary

Revocation can stop future decryption through controlled key services.

It cannot erase:

- plaintext already viewed;
- screenshots;
- exported files;
- unwrapped keys cached outside QEV;
- independent copies.

The product must say this plainly.

---

# 11. Storage and retention

Cryptographic tamper evidence does not prevent deletion.

QEV needs storage modes:

- ordinary customer storage;
- versioned storage;
- locked retention;
- WORM storage;
- legal hold;
- external archive.

Borrow from Azure Immutable Blob and Google Bucket/Object Lock:

- time-based retention;
- legal hold;
- object-level hold;
- container/bucket policy;
- locked irreversible retention;
- audit trail of hold changes.

Before activating an irreversible storage lock, the QEV wizard must show:

- retention length;
- estimated storage effect;
- who can extend it;
- whether it can ever be shortened;
- what happens if the customer needs deletion;
- which legal/compliance authority approved it.

---

# 12. Identity and approvals

## 12.1 Identity-strength labels

Each actor should have a visible level:

- user-entered label;
- source-account assertion;
- organization SSO assertion;
- device-bound assertion;
- passkey/WebAuthn approval;
- organization signature;
- qualified external identity, where applicable.

## 12.2 WebAuthn

Use passkeys/WebAuthn for high-risk human approval where practical.

Bind an approval to:

- exact action hash;
- exact artifact hash;
- policy version;
- case ID;
- approval reason;
- expiration;
- current authorization state.

Do not record “Bryan approved” without showing how that identity was established.

## 12.3 Commit-time revalidation

For high-risk actions, an approval must still be valid at the moment the durable action occurs.

Recheck:

- approver still authorized;
- artifact hash unchanged;
- policy unchanged;
- environment unchanged;
- approval not expired;
- target unchanged.

---

# 13. AI product requirements

## 13.1 Do not compete with full observability products

Phoenix and LangSmith already provide:

- trace visualization;
- prompt versions;
- datasets;
- experiments;
- evaluations;
- replay;
- human labels.

QEV should integrate with those tools and seal selected evidence—not rebuild their entire development experience.

## 13.2 OpenTelemetry-first

Use OTLP and OpenTelemetry semantic conventions.

Support:

- traces;
- spans;
- events;
- logs;
- trace IDs;
- parent relationships;
- resource identity;
- GenAI attributes.

## 13.3 OpenAI Agents and framework processors

The OpenAI Agents SDK supports custom trace processors and records model generations, tool calls, handoffs, guardrails, and custom events.

A QEV trace processor should:

- run locally;
- apply privacy rules before export;
- batch events;
- flush at workflow completion;
- preserve trace and group IDs;
- create a QEV completion event.

Equivalent adapters should follow for other frameworks.

## 13.4 Sensitive-data handling

Prompt and tool data can be sensitive.

Default modes:

- metadata only;
- hash only;
- redacted;
- encrypted full content;
- excluded.

Show the customer a sample of what each mode will store before enabling capture.

## 13.5 AI evidence package

Store:

- application version;
- agent version;
- model provider;
- requested model;
- returned model/deployment;
- model parameters;
- prompt-template version;
- prompt capture mode;
- retrieval source IDs and versions;
- tool schemas;
- tool calls;
- tool outputs;
- guardrail decisions;
- human approvals;
- final output;
- external side effects;
- evaluation result references;
- known gaps.

Do not claim hidden reasoning or chain-of-thought capture.

## 13.6 Evaluation linkage

QEV can preserve:

- dataset version;
- evaluator version;
- evaluation score;
- human label;
- experiment ID;
- result hash.

It should not imply an evaluation score proves factual truth.

---

# 14. Legal and confidential workflows

## 14.1 Borrow from DocuSign’s Certificate of Completion

A QEV package should generate a human-readable certificate containing:

- package ID;
- case or matter ID;
- participants;
- event timeline;
- source systems;
- authentication methods;
- signatures;
- artifact hashes;
- verification result;
- known gaps;
- retention status;
- verifier software version.

Separate transaction metadata from document content so an authorized reviewer can validate some facts without opening privileged content.

## 14.2 Federal evidence authentication

QEV should support documentation useful for Federal Rules of Evidence 901(b)(9), 902(13), and 902(14):

- description of the process/system;
- software and connector versions;
- process controls;
- hash algorithm;
- original and copy hashes;
- qualified-person certification template;
- verification procedure;
- chain-of-custody history.

QEV must not claim that a package is automatically admissible. Authentication does not settle relevance, hearsay, reliability, confrontation, privilege, or other objections.

## 14.3 Borrow from Microsoft Purview eDiscovery

Legal flow requirements:

- case;
- custodian;
- noncustodial source;
- legal hold;
- hold notice;
- acknowledgement;
- collection;
- review set;
- tagging;
- export;
- audit;
- retention release.

QEV’s differentiator is a portable encrypted evidence package, not replacing a complete eDiscovery review platform.

## 14.4 Confidentiality

Required legal defaults:

- customer-controlled gateway;
- customer storage;
- matter-specific keys;
- metadata-only admin view;
- no plaintext support telemetry;
- explicit external reviewer access;
- legal-hold mode;
- complete access records;
- no automatic AI processing unless separately enabled.

---

# 15. Secure software delivery

QEV itself handles sensitive evidence, so its build and update process becomes part of the trust model.

## 15.1 TUF-style updates

The update system must resist:

- malicious update;
- rollback;
- freeze;
- repository compromise;
- signing-key compromise.

Use signed metadata with:

- role separation;
- thresholds where appropriate;
- version numbers;
- expiration;
- target hashes;
- target sizes.

## 15.2 SLSA provenance

Release artifacts need build provenance describing:

- source commit;
- build system;
- dependencies;
- builder identity;
- build parameters;
- resulting artifact digest.

Target signed provenance from a hardened hosted build system.

## 15.3 Sigstore-style release bundles

Publish:

- artifact;
- digest;
- signature;
- certificate;
- transparency proof;
- provenance;
- SBOM.

## 15.4 OWASP ASVS

Use OWASP ASVS 5 as a security requirement and verification baseline for:

- architecture;
- authentication;
- sessions;
- access control;
- validation;
- cryptography;
- logging;
- data protection;
- communications;
- malicious code;
- business logic;
- files;
- APIs;
- configuration.

For the gateway and admin surface, target the assurance level appropriate for sensitive data rather than the minimum level.

---

# 16. Connector certification

A connector is not “done” when it fetches one test object.

Every connector release must pass automated certification.

## Required tests

### Authorization

- initial authorization;
- least-privilege scopes;
- expired token;
- revoked token;
- refresh;
- account switched;
- insufficient scope;
- tenant mismatch.

### Webhooks

- valid signature;
- invalid signature;
- replay;
- duplicate;
- out of order;
- delayed;
- malformed body;
- large body;
- unsupported event;
- provider retry.

### Polling

- initial backfill;
- incremental cursor;
- pagination;
- overlap window;
- deletion;
- rate limit;
- partial page;
- changed schema;
- stale cursor.

### Reliability

- gateway restart;
- network failure;
- storage failure;
- queue full;
- duplicate process;
- concurrent delivery;
- dead-letter replay.

### Privacy

- secret filtering;
- field mapping;
- redaction;
- hash-only;
- excluded field;
- error-log scrubbing.

### Multi-tenancy

- credential isolation;
- event isolation;
- package isolation;
- cross-tenant ID attack;
- wrong connection reference.

### Upgrade

- old connector version;
- new connector shadow mode;
- migration;
- rollback;
- event equivalence report.

A connector must publish its tested capabilities and known limitations.

---

# 17. Setup experience

## 17.1 Zero-code path

For a small business:

1. Install signed QEV Gateway.
2. Choose a flow.
3. Connect accounts.
4. Review requested permissions.
5. Choose storage.
6. Choose package recipients.
7. Preview captured fields.
8. Run a fake workflow.
9. Review the package.
10. Enable shadow mode.
11. Enable live sealing.

## 17.2 Low-code path

For a small AI builder:

1. Install one package or change one OTLP endpoint.
2. Run one traced test request.
3. QEV detects the framework.
4. Builder chooses privacy mode.
5. QEV shows the captured trace.
6. Builder defines completion.
7. Builder optionally defines high-risk tools.
8. QEV runs in record-only mode.
9. Builder enables approval/gate mode later.

## 17.3 Pro-code path

- SDK;
- signed webhook;
- OTLP;
- connector SDK;
- MCP proxy;
- HTTP proxy;
- custom mapping functions.

## 17.4 Permission clarity

For every permission, explain:

- what QEV reads;
- why;
- whether it writes;
- whether it can delete;
- where the data goes;
- retention;
- how to revoke access;
- what stops working after revocation.

---

# 18. Evidence and trust user interface

Never display a single green “verified” badge for everything.

Display separate verdicts:

```text
Package integrity            Verified
Package signer               Verified: Qira Test Organization
Source webhook               Verified: Stripe
Actor identity               Organization SSO
Artifact match               Verified
Timestamp                    Gateway observed
External time anchor         Not present
Evidence completeness        8 of 10 required items
Known gaps                   Disposal receipt; completion acknowledgement
Content truth                Not independently determined
```

This trust breakdown is one of QEV’s strongest possible differentiators.

---

# 19. AH Crap Cleanup readiness gate

Do not use real customer jobs until these exist:

## Platform foundation

- installable gateway;
- event schema;
- evidence bundle;
- package verifier;
- encrypted local storage;
- connector framework;
- health screen;
- backup and recovery;
- credential protection;
- package signing.

## Field Service flow

- job creation;
- estimate;
- customer approval;
- before photos;
- scope change;
- change approval;
- after photos;
- receipt;
- invoice;
- payment;
- completion;
- package seal.

## Input paths

At minimum:

- QEV customer/job portal;
- phone photo upload;
- watched folder;
- generic signed webhook or email import.

## Testing

1. synthetic jobs;
2. failure and tampering tests;
3. historical redacted jobs;
4. shadow mode;
5. limited live jobs;
6. automation;
7. gate mode last.

## Live-pilot criteria

- no silent data loss;
- clear missing-evidence status;
- package opens after backup restore;
- altered package fails;
- duplicate events do not duplicate actions;
- disconnected source alerts;
- customer data does not reach Qira by default;
- normal job can be completed without developer work;
- manual work added per job is measured.

---

# 20. AI-builder readiness gate

Before marketing “easy AI integration,” QEV needs:

- JavaScript SDK;
- Python SDK;
- OTLP receiver;
- OpenAI Agents processor;
- generic OpenAI-compatible proxy or adapter;
- MCP tool proxy later;
- local buffering;
- sensitive-data preview;
- framework auto-detection where possible;
- one-command local gateway;
- sample app;
- trace-to-package completion;
- high-risk approval example;
- known coverage matrix.

Marketing must distinguish:

- observed directly;
- reported by framework;
- inferred;
- unavailable.

---

# 21. What should be integrated rather than rebuilt

## Integrate or reuse

- OAuth infrastructure;
- OpenTelemetry;
- CloudEvents;
- AsyncAPI;
- durable workflow runtime;
- KMS/HSM;
- WORM cloud storage;
- e-signature providers;
- eDiscovery systems;
- identity providers;
- AI observability/evaluation systems;
- trusted timestamp authorities;
- secure update frameworks;
- build provenance systems.

## Build as QEV intellectual property

- evidence normalization;
- source/provenance binding;
- evidence coverage model;
- privacy mapping;
- flow packs;
- trust-verdict model;
- encrypted evidence bundle;
- multi-slot access;
- cross-system package completion;
- portable independent verifier;
- known-gap representation;
- record/gate dual mode;
- industry review packets.

---

# 22. What not to copy

Borrow public design patterns and standards. Do not copy proprietary code, user interfaces, wording, trademarks, connector definitions, or restricted schemas.

Do not add a feature merely because a competitor has it.

Reject:

- generic automation unrelated to evidence;
- another broad chat product;
- full eDiscovery review;
- full AI observability replacement;
- a new cryptographic primitive;
- blockchain without a specific threat requirement;
- public logging of confidential metadata;
- browser scraping as the primary connector strategy;
- “unhackable,” “court-proof,” or “complete reasoning” claims.

---

# 23. Priority backlog

## P0 — required before any serious pilot

- CloudEvents-aligned event contract;
- RFC 8785 canonicalization;
- gateway durable queue;
- idempotency and deduplication;
- signed webhooks;
- out-of-order handling;
- event source/raw hash preservation;
- evidence-gap model;
- Evidence Bundle V1;
- asymmetric package signatures;
- package verifier;
- encrypted package storage;
- local credential vault;
- setup wizard;
- shadow mode;
- connector health;
- signed release;
- backup/restore;
- AH Crap synthetic flow.

## P1 — required before external commercial pilots

- organization SSO;
- WebAuthn approvals;
- KMS key slots;
- rewrap and rotation;
- WORM storage option;
- signed checkpoints;
- trusted timestamp option;
- connector certification suite;
- JS and Python SDKs;
- OTLP;
- GitHub connector;
- AI trace processor;
- external reviewer slots;
- audit export;
- security review.

## P2 — enterprise expansion

- private transparency service;
- multi-region control plane;
- HSM;
- policy marketplace;
- legal hold orchestration;
- Clio/Microsoft/e-sign connectors;
- full DevOps connector pack;
- SIEM integration;
- data-residency controls;
- connector marketplace;
- enterprise support and SLAs;
- formal audit and compliance program.

---

# 24. Product acceptance test

QEV has become a real commercial connector platform only when a nontechnical test customer can:

1. install it;
2. connect a supported account;
3. understand permissions;
4. run a sample;
5. see the event arrive;
6. see its source and identity strength;
7. see redacted/hash/full fields;
8. see missing evidence;
9. complete a workflow;
10. create an encrypted package automatically;
11. open it through an authorized key path;
12. verify it on another machine;
13. detect a changed file;
14. see a connector outage;
15. restore from backup;
16. add a recipient without re-encrypting all content;
17. revoke future controlled access;
18. export a readable verification packet;
19. operate without Qira receiving plaintext;
20. do all of this without custom development.

---

# 25. Final architecture decision

The correct next build is:

> A customer-controlled QEV Gateway using standard event and integration contracts, durable ingestion, explicit trust semantics, customer-controlled keys and storage, signed hash-chain checkpoints, and a portable encrypted Evidence Bundle. It should ship first with a no-code Field Service flow and a low-code AI/DevOps integration path.

AH Crap Cleanup should be the first controlled deployment **after** this P0 slice works with synthetic and historical data.

The AH Crap pilot should validate usability and business value. It should not be used to discover whether the gateway can reliably receive, preserve, encrypt, and verify evidence.

---

# 26. Primary references reviewed

## Current QEV

- https://secure.imagineqira.com/
- https://github.com/TheArtOfSound/qev-desktop
- https://theartofsound.github.io/qev-desktop/#/tool
- https://theartofsound.github.io/qev-model-intake/demo.html

## Integrations and workflow

- https://nango.dev/docs/getting-started/intro-to-nango
- https://nango.dev/docs/guides/functions/functions-guide
- https://docs.workato.com/en/ipaas
- https://docs.workato.com/en/recipes
- https://help.vanta.com/en/collections/12575285-integrations
- https://help.drata.com/en/articles/13273728-understanding-connections-in-drata
- https://docs.temporal.io/
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/api/idempotent_requests

## Event and API standards

- https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md
- https://www.asyncapi.com/docs/reference/specification/v3.0.0
- https://datatracker.ietf.org/doc/html/rfc8785
- https://opentelemetry.io/docs/specs/semconv/
- https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/

## Integrity, signatures, and time

- https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html
- https://docs.immudb.io/master/immudb.html
- https://docs.sigstore.dev/about/bundle/
- https://docs.sigstore.dev/logging/overview/
- https://www.rfc-editor.org/rfc/rfc3161.html
- https://in-toto.io/docs/specs/

## Keys and immutable storage

- https://developer.hashicorp.com/vault/docs/secrets/transit
- https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
- https://slack.com/help/articles/360019110974-Slack-Enterprise-Key-Management-Slack-Enterprise-Key-Management
- https://www.box.com/security/keysafe
- https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview
- https://docs.cloud.google.com/storage/docs/bucket-lock

## AI systems

- https://openai.github.io/openai-agents-python/tracing/
- https://arize.com/docs/phoenix
- https://docs.langchain.com/langsmith/evaluation-quickstart
- https://docs.langchain.com/langsmith/manage-datasets

## Legal evidence

- https://www.law.cornell.edu/rules/fre/rule_901
- https://www.law.cornell.edu/rules/fre/rule_902
- https://www.docusign.com/trust/security/transaction-data-use
- https://learn.microsoft.com/en-us/purview/purview-compliance
- https://docs.developers.clio.com/clio-manage/api-reference/

## Secure releases

- https://theupdateframework.io/docs/security/
- https://slsa.dev/spec/v1.2/build-track-basics
- https://owasp.org/www-project-application-security-verification-standard/
- https://www.w3.org/TR/webauthn/all/
