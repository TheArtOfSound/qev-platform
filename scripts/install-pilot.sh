#!/usr/bin/env bash
# QEV pilot one-command install (macOS / Linux)
# Seamless-Use Spec §3 — local developer / small-business appliance path.
# Does NOT claim notarized enterprise installers (those are P2).
#
# Usage:
#   curl -fsSL … | bash   # when published
#   OR from repo:
#   bash scripts/install-pilot.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== QEV Pilot Install =="
echo "Root: $ROOT"

# Preflight host
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 20+ is required. Install from https://nodejs.org"
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "ERROR: Node $NODE_MAJOR is too old; need >= 20"
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "ERROR: corepack not found (ships with Node 20+)"
  exit 1
fi

# Port check
PORT="${QEV_PORT:-7443}"
if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARN: port $PORT already in use — stop the other process or set QEV_PORT"
  fi
fi

# Disk (best-effort)
if command -v df >/dev/null 2>&1; then
  AVAIL_KB="$(df -k "$ROOT" | awk 'NR==2 {print $4}')"
  if [[ -n "${AVAIL_KB:-}" && "$AVAIL_KB" -lt 500000 ]]; then
    echo "WARN: less than ~500MB free disk"
  fi
fi

echo "Enabling pnpm via corepack…"
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9.15.4 --activate >/dev/null 2>&1 || true

echo "Installing dependencies…"
pnpm install

echo "Building packages…"
pnpm --filter @imagineqira/qev-shared build
pnpm --filter @imagineqira/qev-core build
pnpm --filter @imagineqira/qev-event-schema build
pnpm --filter @imagineqira/qev-policy-engine build
pnpm --filter @imagineqira/qev-evidence-bundle build
pnpm --filter @imagineqira/qev-runtime build
pnpm --filter @imagineqira/qev-trust build
pnpm --filter @imagineqira/qev-ops build
pnpm --filter @imagineqira/qev-sdk build
pnpm --filter @imagineqira/qev-connector-sdk build
pnpm --filter @imagineqira/qev-gateway build
pnpm --filter @imagineqira/qev-verifier build

mkdir -p data/packages data/events data/queue data/case-log data/config data/signing data/packages/backup

# Helper launchers
mkdir -p bin
cat > bin/qev-gateway <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$ROOT"
export QEV_HOST="\${QEV_HOST:-127.0.0.1}"
export QEV_PORT="\${QEV_PORT:-7443}"
exec pnpm exec tsx apps/gateway/src/index.ts
EOF
chmod +x bin/qev-gateway

cat > bin/qev-pilot-open <<EOF
#!/usr/bin/env bash
set -euo pipefail
URL="http://127.0.0.1:\${QEV_PORT:-7443}/"
if command -v open >/dev/null 2>&1; then open "\$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "\$URL"
else echo "Open \$URL in your browser"
fi
EOF
chmod +x bin/qev-pilot-open

echo ""
echo "Install complete."
echo ""
echo "Start gateway (no further build needed):"
echo "  $ROOT/bin/qev-gateway"
echo ""
echo "Then open:"
echo "  http://127.0.0.1:${PORT}/"
echo "  wizard · portal · review · /v1/health · /v1/preflight"
echo ""
echo "Tests:"
echo "  pnpm test"
echo "  pnpm pilot:synthetic"
echo "  pnpm stage2:import -- docs/stage2/jobs/JOB-HIST-001"
echo ""
echo "This is the pilot appliance path — not a notarized enterprise installer."
