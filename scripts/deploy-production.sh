#!/usr/bin/env bash
# Deploy qev-platform public-site + gateway to secure.imagineqira.com (AWS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-autohustle}"
WEB_ROOT="/var/www/secure-imagineqira"
APP_ROOT="/opt/qev-platform"

echo "=== QEV production deploy ==="
echo "Host: $HOST"
echo "Web:  $WEB_ROOT"
echo "App:  $APP_ROOT"

# --- 1) Static marketing / trust / SEO pages (additive, no --delete on root) ---
echo "[1/6] Sync public-site pages..."
ssh "$HOST" "sudo mkdir -p $WEB_ROOT/trust $WEB_ROOT/field-service-evidence $WEB_ROOT/tools/envelope $WEB_ROOT/audit-status $WEB_ROOT/docs && sudo chown -R ubuntu:ubuntu $WEB_ROOT/trust $WEB_ROOT/field-service-evidence $WEB_ROOT/tools $WEB_ROOT/audit-status $WEB_ROOT/docs || true"

rsync -avz --delete \
  "$ROOT/public-site/trust/" \
  "$HOST:$WEB_ROOT/trust/"

rsync -avz --delete \
  "$ROOT/public-site/field-service-evidence/" \
  "$HOST:$WEB_ROOT/field-service-evidence/"

rsync -avz --delete \
  "$ROOT/public-site/tools/envelope/" \
  "$HOST:$WEB_ROOT/tools/envelope/"

rsync -avz --delete \
  "$ROOT/public-site/audit-status/" \
  "$HOST:$WEB_ROOT/audit-status/"

# Root SEO files
rsync -avz \
  "$ROOT/public-site/robots.txt" \
  "$ROOT/public-site/sitemap.xml" \
  "$ROOT/public-site/sitemap-index.xml" \
  "$ROOT/public-site/sitemap-pages.xml" \
  "$ROOT/public-site/sitemap-docs.xml" \
  "$ROOT/public-site/sitemap-trust.xml" \
  "$HOST:$WEB_ROOT/"

# IndexNow key file(s)
for f in "$ROOT"/public-site/*.txt; do
  base="$(basename "$f")"
  [[ "$base" == *example* ]] && continue
  [[ "$base" == indexnow-key.txt ]] && continue
  rsync -avz "$f" "$HOST:$WEB_ROOT/"
done
if [[ -f "$ROOT/public-site/.indexnow-key" ]]; then
  KEY="$(cat "$ROOT/public-site/.indexnow-key")"
  if [[ -f "$ROOT/public-site/${KEY}.txt" ]]; then
    rsync -avz "$ROOT/public-site/${KEY}.txt" "$HOST:$WEB_ROOT/"
  fi
fi

# --- 2) Sync application monorepo ---
echo "[2/6] Sync qev-platform application..."
ssh "$HOST" "sudo mkdir -p $APP_ROOT && sudo chown ubuntu:ubuntu $APP_ROOT"
rsync -avz \
  --exclude node_modules \
  --exclude .git \
  --exclude 'data/packages/*.qevpkg.json' \
  --exclude 'data/packages/certificates' \
  --exclude 'data/events' \
  --exclude 'data/queue' \
  --exclude 'data/case-log' \
  --exclude 'data/signing' \
  --exclude '**/dist' \
  --exclude '.demo-out' \
  "$ROOT/" \
  "$HOST:$APP_ROOT/"

# --- 3) Install + build on server ---
echo "[3/6] Install and build on server..."
ssh "$HOST" "bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/qev-platform
corepack enable || true
corepack prepare pnpm@9.15.4 --activate || true
pnpm install
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
mkdir -p data/packages data/packages/backup data/events data/queue data/case-log data/config data/signing data/packages/certificates
REMOTE

# --- 4) Secrets + systemd ---
echo "[4/6] Configure secrets and systemd service..."
ssh "$HOST" "bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/qev-platform
if [[ ! -f .env.production ]]; then
  WH=$(openssl rand -hex 24)
  TK=$(openssl rand -hex 24)
  PP=$(openssl rand -hex 16)
  cat > .env.production <<EOF
QEV_HOST=127.0.0.1
QEV_PORT=7443
QEV_DATA_DIR=/opt/qev-platform/data
QEV_STORAGE_DIR=/opt/qev-platform/data/packages
QEV_TENANT_ID=secure-imagineqira
QEV_SHADOW_MODE=true
QEV_WEBHOOK_SECRET=$WH
QEV_INGEST_TOKEN=$TK
QEV_PACKAGE_PASSPHRASE=$PP
EOF
  chmod 600 .env.production
  echo "Created .env.production with fresh secrets"
else
  echo "Keeping existing .env.production"
fi

# Resolve pnpm/tsx paths
PNPM=$(command -v pnpm)
NODE=$(command -v node)
# Use absolute path for tsx via pnpm
cat > /tmp/qev-gateway.service <<EOF
[Unit]
Description=QEV Platform Capture Gateway
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/qev-platform
EnvironmentFile=/opt/qev-platform/.env.production
ExecStart=$PNPM exec tsx apps/gateway/src/index.ts
Restart=always
RestartSec=3
# Do not leak secrets in logs
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
sudo mv /tmp/qev-gateway.service /etc/systemd/system/qev-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable qev-gateway
sudo systemctl restart qev-gateway
sleep 2
sudo systemctl is-active qev-gateway
curl -sS http://127.0.0.1:7443/healthz | head -c 200
echo
REMOTE

# --- 5) Nginx platform proxy ---
echo "[5/6] Update nginx for /platform/ ..."
ssh "$HOST" "bash -s" <<'REMOTE'
set -euo pipefail
CONF=/etc/nginx/sites-available/secure.imagineqira.com
# Backup once
sudo cp -n "$CONF" "${CONF}.bak.qev-platform" 2>/dev/null || sudo cp "$CONF" "${CONF}.bak.qev-platform.$(date +%s)"

# Insert platform proxy if missing
if ! sudo grep -q 'location /platform/' "$CONF"; then
  sudo python3 - <<'PY'
from pathlib import Path
path = Path("/etc/nginx/sites-available/secure.imagineqira.com")
text = path.read_text()
snippet = '''
    # QEV commercial platform gateway (customer-controlled appliance demo)
    location /platform/ {
        proxy_pass http://127.0.0.1:7443/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        add_header Cache-Control "no-store" always;
    }
    location = /platform {
        return 302 /platform/;
    }

'''
  marker = "    location / {"
  if marker not in text:
    raise SystemExit("marker not found in nginx conf")
  text = text.replace(marker, snippet + marker, 1)
  path.write_text(text)
  print("nginx platform location inserted")
else:
  print("nginx platform location already present")
PY
fi
# sites-enabled may be a separate copy (not a symlink) on this host
sudo cp /etc/nginx/sites-available/secure.imagineqira.com /etc/nginx/sites-enabled/secure.imagineqira.com
sudo nginx -t
sudo systemctl reload nginx
REMOTE

# --- 6) Verify public URLs ---
echo "[6/6] Verify public endpoints..."
for u in \
  "https://secure.imagineqira.com/trust/" \
  "https://secure.imagineqira.com/field-service-evidence/" \
  "https://secure.imagineqira.com/tools/envelope/" \
  "https://secure.imagineqira.com/audit-status/" \
  "https://secure.imagineqira.com/robots.txt" \
  "https://secure.imagineqira.com/sitemap.xml" \
  "https://secure.imagineqira.com/platform/healthz" \
  "https://secure.imagineqira.com/platform/"
 do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$u" || echo err)
  echo "  $code  $u"
done

echo ""
echo "=== Deploy finished ==="
echo "Platform UI:  https://secure.imagineqira.com/platform/"
echo "Trust:        https://secure.imagineqira.com/trust/"
echo "Field service:https://secure.imagineqira.com/field-service-evidence/"
echo "Gateway env secrets live only on server: $APP_ROOT/.env.production"
echo "Ingest token (server-side): ssh $HOST 'grep QEV_INGEST_TOKEN /opt/qev-platform/.env.production'"
