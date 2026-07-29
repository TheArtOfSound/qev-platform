# generic-webhook

**Status:** available in MVP gateway

## Setup

1. Point your system at `POST /v1/webhooks/{connector_id}`
2. Sign the raw body with HMAC-SHA256 using `QEV_WEBHOOK_SECRET`
3. Header: `X-QEV-Signature: sha256=<hex>`
4. Body minimum fields: `case_id`, recommended `flow_id`, `action`, `actor`, `outcome`, `artifacts`

## Signature

```text
signature = HMAC-SHA256(webhook_secret, raw_body_bytes)
header    = sha256=<hex lowercase>
```

GitHub-style `X-Hub-Signature-256` is also accepted if it matches the same secret.

## What verification claims

- Signature is valid for the shared secret held by the gateway
- Raw body SHA-256 is stored on the event
- Event was normalized to `qev.event.v1`

## What it does not claim

- That the upstream system told the truth
- That the actor identity is company SSO (unless you mark it so)
