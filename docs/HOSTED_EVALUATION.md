# Authenticated hosted evaluation

The hosted gateway is an operator-controlled, single-tenant synthetic evaluation. It is not an open multi-tenant customer service. Do not submit confidential customer records. Deploy the customer-controlled gateway inside the customer's environment for real-data evaluation under an agreed scope.

Production startup requires explicit webhook secret, ingest token, package passphrase (at least 32 characters each) and tenant ID. Production always requires bearer authentication for private reads, portal/photo writes, settings and admin pages. Signed webhooks use the configured HMAC secret. Anonymous health returns only liveness and evaluation status. Requests are bounded to 1 MiB, storage IDs reject path traversal, and error responses do not expose exception details. Operator evaluation cannot enable gate mode or watched host folders.

Set `QEV_DEPLOYMENT_KIND=operator_evaluation`, `QEV_SHADOW_MODE=true`, `NODE_ENV=production`, and a private `QEV_DATA_DIR`. `QEV_PATH_PREFIX=/platform` supports the public reverse-proxy mount. Keep environment files and the gateway signing key outside source and public release artifacts. This gateway key is separate from the existing website signer and from customer-held vault keys.

Acceptance must exercise authenticated event capture, encrypted seal, wrong-passphrase denial, verification, persistence across restart, anonymous access rejection and a private backup restore. A health response alone does not prove these properties. Cryptographic verification does not establish source truth, independent timestamps or compliance certification.

The browser vault remains local and needs no account. The legacy chat workspace is a separate unavailable service; bringing up the capture gateway does not restore chat, voice or its old account system.

The root build/test scripts quote workspace glob filters for Windows command shells. Always build packages before gateway tests, since workspace exports point to `dist`.
