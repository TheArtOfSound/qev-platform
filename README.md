# qev-platform

**Customer-controlled QEV Capture Gateway, SDKs, connectors, and evidence packages.**

This is the commercial platform layer. It does **not** replace the Vault V2 envelope core (`qev-desktop` / browser vault). It makes that core useful inside real company workflows.

> Status: **MVP 0.1.0 working prototype** — not enterprise-certified. No third-party audit. No KMS. Local trust model.

## One product stack

| Layer | Repo / component | Status |
|---|---|---|
| Envelope Core | `qev-desktop`, secure.imagineqira.com/vault | available today |
| Capture Gateway | `apps/gateway` | **MVP here** |
| Connectors | `connectors/*` | webhook available; others planned |
| Flow packs | `flows/*` | devops-change MVP |
| Verify | `apps/verifier` | MVP CLI |
| Control plane | — | planned (no plaintext) |

## Vertical slice (what works today)

```text
Signed webhook  →  qev.event.v1  →  policy  →  QEV-EVIDENCE-BUNDLE-V1
    →  Vault V2 seal  →  customer disk  →  verify
```

## Correct order (do not skip)

```text
Platform foundation (this repo)
  → Stage 1 synthetic jobs
  → Stage 2 historical redacted jobs
  → Stage 3 shadow mode on live jobs
  → Stage 4 limited live pilot (5–10 jobs)
  → Stage 5 automation
  → Stage 6 gate mode
  → Field Service product (AH Crap = deployment #1)
```

See [docs/PILOT_READY_ROADMAP.md](docs/PILOT_READY_ROADMAP.md).

## Quick start (seamless pilot path)

**One-command install (no hand-editing required after):**

```bash
cd /Users/bry/Projects/qev-platform
bash scripts/install-pilot.sh
./bin/qev-gateway
# open http://127.0.0.1:7443/
```

**Or developer path:**

```bash
pnpm install && pnpm test
pnpm dev:gateway
pnpm pilot:synthetic
pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001
```

**Specs / backlog:** [ENGINEERING_BACKLOG.md](docs/ENGINEERING_BACKLOG.md) · [PILOT_READY_ROADMAP.md](docs/PILOT_READY_ROADMAP.md) · [Seamless-Use Spec](docs/QEV_End_to_End_Automation_and_Seamless_Use_Specification.md)


Docker:

```bash
cd deploy/docker && docker compose up --build
```

### Signed webhook example

```bash
BODY='{"flow_id":"devops-change","case_id":"CHG-1","action":"deployment.completed","actor":{"id":"alice@acme.com"},"outcome":"success","artifacts":[{"name":"app.tgz","sha256":"'"$(printf a | shasum -a 256 | awk '{print $1}')"'"}]}'
SIG=$(printf %s "$BODY" | openssl dgst -sha256 -hmac "dev-webhook-secret-change-me" | awk '{print $2}')
curl -sS -X POST http://127.0.0.1:7443/v1/webhooks/ci \
  -H "content-type: application/json" \
  -H "x-qev-signature: sha256=$SIG" \
  -d "$BODY"
```

### JS SDK

```ts
import { QEV } from "@imagineqira/qev-sdk";

const qev = new QEV({
  endpoint: "http://127.0.0.1:7443",
  token: "dev-ingest-token-change-me",
});

await qev.capture({
  flow: "devops-change",
  caseId: "CHG-1",
  type: "deployment.completed",
  actor: { id: "alice@acme.com" },
  artifact: await qev.file("./dist/app.tgz"),
});

await qev.complete({ flow: "devops-change", caseId: "CHG-1" });
```

## Contracts

- `schemas/qev.event.v1.schema.json`
- `schemas/qev.evidence-bundle.v1.schema.json`
- `schemas/gateway.openapi.yaml`

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Inventory & reuse map](docs/INVENTORY_REUSE_MAP.md)
- [Public cleanup plan](docs/PUBLIC_CLEANUP_PLAN.md)
- Blueprint: `~/Downloads/QEV_Commercial_Platform_Blueprint.md`

## What verification claims

Exact properties only, for example:

- Webhook HMAC-SHA256 is valid for the gateway secret
- Vault V2 decrypt succeeds with the passphrase
- `integrity.events_sha256` matches canonical events
- Artifact entries have well-formed SHA-256 fingerprints

**Does not claim:** source honesty, legal privilege, AI truthfulness, or independent time authority (unless recorded).

## Security / commercial blockers (not done)

See blueprint §15. Includes third-party audit, signed installers, KMS/HSM, rotation, SBOM, etc.

## License

MIT for this MVP monorepo unless otherwise noted. Commercial packaging/trademarks require counsel review (open-core model recommended in the blueprint).
