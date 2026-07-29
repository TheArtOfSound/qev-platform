# QEV audit package (living)

This directory is the **release-gate system** from the July 29, 2026 gap audit.

| File | Purpose |
|---|---|
| `QEV_Audit_User_Flow_and_Gap_Report.md` | Full narrative audit |
| `QEV_Release_Gates.md` | Gates A–F |
| `QEV_Master_Test_Cases.json` | 136 test cases + 28 findings |
| `FINDINGS_STATUS_MATRIX.md` | Status after platform pilot deploy |
| `../audit` scripts in repo root | Site re-sign, SEO, deploy |

## Verdict (unchanged)

**Not ready for live AH Crap customer data.**

Platform pilot at https://secure.imagineqira.com/platform/ is a foundation, not Gate E/F completion.

## How to use the 136 cases

1. Each release must update `current_status` fields in `QEV_Master_Test_Cases.json` (or a CI-generated overlay).
2. Gate B requires synthetic failure-injection suite green.
3. Gate F (Protected badge) is blocked until continuous checks + independent assessment.

## Quick commands

```bash
# Status matrix
cat docs/audit/FINDINGS_STATUS_MATRIX.md

# Re-sign public site integrity (needs private key)
python3 scripts/resign-site-integrity.py \
  --site-root /tmp/secure-imagineqira-resign \
  --key /path/to/site-signer.ed25519.key

# Deploy platform
bash scripts/deploy-production.sh
```
