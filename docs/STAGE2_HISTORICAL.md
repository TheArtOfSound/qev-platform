# Stage 2 — Historical AH Crap (or any field-service) jobs

**Goal:** Prove QEV reconstructs *real* business situations using **redacted copies only** — no active customers, no live systems.

Do **not** invent new formats during Stage 2. Use Field Service flow + existing connectors.

---

## Preparation checklist

- [ ] Platform Stage 0–1 green (`pnpm test`, `pnpm pilot:synthetic`)  
- [ ] Separate Stage 2 workspace/data dir (never production packages folder)  
- [ ] Written redaction rules (below) approved by operator  
- [ ] 3–8 completed jobs selected (mix: simple, scope change, dispute-prone)  
- [ ] Original files **copied** then sanitized; originals stay offline  

---

## Redaction rules (minimum)

| Field | Action |
|---|---|
| Customer legal name | Replace with `Customer A/B/C` |
| Phone / email / address | Redact or synthetic |
| Payment card / bank | Drop or hash_only last4 synthetic |
| Employee personal phone | Redact |
| Internal notes / gossip | Drop (test that internal_notes privacy works) |
| Photos of people/faces | Blur or use non-identifying site photos |
| Exact GPS | Drop or coarse city only |
| Other customers’ data | Never include |

Preserve **structure**: estimate amount ranges OK if rounded; dates can stay; job sequence must remain realistic.

---

## Folder layout

```text
docs/stage2/jobs/
  JOB-HIST-001/
    meta.json          # redacted case metadata
    events.jsonl       # optional pre-normalized events
    files/
      before-1.jpg
      after-1.jpg
      estimate.pdf
      invoice.pdf
    REDACTION_LOG.md   # what was changed
  JOB-HIST-002/
    ...
```

Use `meta.json` schema:

```json
{
  "case_id": "JOB-HIST-001",
  "title": "Water heater install (redacted)",
  "customer_label": "Customer A",
  "actions": [
    { "action": "job.created", "at": "2026-03-01T14:00:00Z", "actor": "office@redacted.local" },
    { "action": "estimate.approved", "at": "2026-03-02T10:00:00Z", "actor": "customer-a@redacted.local" },
    { "action": "evidence.before_captured", "file": "files/before-1.jpg" },
    { "action": "work.completed", "at": "2026-03-05T16:00:00Z", "actor": "tech@redacted.local" },
    { "action": "evidence.after_captured", "file": "files/after-1.jpg" },
    { "action": "invoice.issued", "at": "2026-03-06T09:00:00Z" }
  ],
  "questions_for_reviewer": [
    "Can you explain the job without calling the office?",
    "Is anything missing that would matter in a disagreement?",
    "Is anything still too identifiable?"
  ]
}
```

---

## Import procedure

```bash
# Gateway running on 7443
pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001
```

Script will:

1. Create portal events for each action  
2. Hash and upload files as before/after/other  
3. Seal package  
4. Write verification report to `docs/stage2/out/`  

---

## Evaluation questions (per job)

| # | Question | Pass criteria |
|---|---|---|
| 1 | Can the record explain the job? | Non-author understands sequence |
| 2 | Understandable package? | Review UI multi-verdict readable |
| 3 | Too much data? | No unnecessary PII |
| 4 | Missing anything important? | Gaps listed honestly |
| 5 | Time to prepare? | Manual prep minutes recorded |
| 6 | Would it help a disagreement? | Yes / partial / no |

---

## Gate to Stage 3 (shadow)

- [ ] ≥3 historical jobs imported and sealed  
- [ ] All evaluation tables filled  
- [ ] No format changes required mid-import  
- [ ] Operator would trust shadow mode on live jobs  
- [ ] Known product gaps filed as P1 backlog items only  

**Do not** enable gate mode or auto-blocking from Stage 2 results alone.
