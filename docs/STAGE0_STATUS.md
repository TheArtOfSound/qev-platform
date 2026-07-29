# Stage 0 / Seamless P0 status

**Version:** 0.3.0-seamless-p0

| Component | Status | Notes |
|---|---|---|
| Gateway process | **done** | `./bin/qev-gateway` after install |
| One-command install | **done** | `bash scripts/install-pilot.sh` |
| Durable queue + DLQ | **done** | |
| Case log chain | **done** | |
| Event + Evidence Bundle | **done** | |
| Field Service flow | **done** | |
| Job portal / photo / webhook | **done** | |
| Setup wizard | **done** | preflight-gated enable |
| Multi-verdict review | **done** | includes package signer |
| **Ed25519 package signatures** | **done** | local org key in `data/signing/` |
| **Preflight checks** | **done** | `/v1/preflight` blocks activation |
| **Completeness engine** | **done** | on case + seal |
| **Case matching** | **done** | `/v1/match` |
| **Modes record/shadow/gate** | **done** | gate soft + human confirm |
| **Health dashboard API** | **done** | `/v1/health` |
| Stage 1 synthetic | **done** | `pnpm pilot:synthetic` |
| Stage 2 template + import | **done** | `pnpm stage2:import` |
| Ranked backlog | **done** | `docs/ENGINEERING_BACKLOG.md` |
| Seamless-Use Spec ingested | **done** | requirements, not finished software |
| Supplemental packages | P1 | late events must not rewrite seal |
| OAuth one-click | P2 | |
| Notarized installers | P2 | |
| KMS / WORM / audit | P3 | |

## Seamless measurable targets (P0)

| Target | Met? |
|---|---|
| Business user can avoid YAML/JSON for Field Service pilot | **yes** (wizard/portal) |
| Install without inventing architecture mid-job | **yes** (one script) |
| AI builder one SDK call | partial (`@imagineqira/qev-sdk`) |
| No terminal after install for daily use | **yes** (browser UI) |
| Custom code exception for standard path | **yes** for portal/webhook/photo |

## Run

```bash
bash scripts/install-pilot.sh
./bin/qev-gateway
open http://127.0.0.1:7443/
pnpm pilot:synthetic
pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001
```
