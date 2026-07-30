import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  entitlementForCapture,
  licenseSummary,
  loadLicense,
  type CaptureAction,
  type License,
} from "./license.js";
import {
  hmacSha256Hex,
  timingSafeEqualHex,
  sha256Hex,
  newId,
} from "@imagineqira/qev-shared";
import {
  assertQevEventV1,
  normalizeGenericWebhook,
  type QevEventV1,
  type GenericWebhookBody,
  type EvidenceBundleV1,
} from "@imagineqira/qev-event-schema";
import {
  evaluatePolicy,
  applyDecisionToEvent,
  policyForFlow,
} from "@imagineqira/qev-policy-engine";
import {
  buildEvidenceBundle,
  verifyEvidenceBundle,
} from "@imagineqira/qev-evidence-bundle";
import {
  sealEvidencePackage,
  openEvidencePackage,
  verifyOuterPackageSignature,
  type QevPackageFile,
} from "@imagineqira/qev-core";
import {
  DurableQueue,
  CaseLog,
  makeIdempotencyKey,
} from "@imagineqira/qev-runtime";
import {
  buildMultiVerdict,
  FIELD_SERVICE_PACK,
  buildPackageSealCertificate,
  issueWorkflowCertificate,
  badgeSvg,
  ISSUABLE_NOW,
} from "@imagineqira/qev-trust";
import {
  evaluateCompleteness,
  matchCase,
  runPreflight,
  normalizeMode,
  gateWouldBlock,
  MODE_BEHAVIORS,
  REQUIRES_HUMAN_CONFIRMATION,
} from "@imagineqira/qev-ops";
import { writeFile as writeFileFs, unlink } from "node:fs/promises";
import type { GatewayConfig } from "./config.js";
import { GatewayStore } from "./store.js";
import { SettingsStore, type PilotSettings } from "./settings.js";
import type { SigningKeyStore } from "./keys.js";


async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(data);
}

function unauthorized(res: ServerResponse, message: string): void {
  json(res, 401, { error: message });
}

function parseAuth(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

/**
 * Gate for endpoints that expose internal posture.
 *
 * The 2026-07-29 audit found GET /v1/health served the gateway's entire
 * internal state to anyone: every preflight check and its detail strings,
 * the connector inventory, the org signing key_id, queue depths, case-log
 * state and the human-confirmation policy list. robots.txt disallowed the
 * path, but robots is not an access control and that file says so itself.
 *
 * Fails closed on purpose. A gateway still running the shipped default
 * token is treated as unconfigured, not as authorised - otherwise the
 * "protection" is a published constant.
 */
function isDetailAuthorized(
  req: IncomingMessage,
  ingestToken: string,
): { ok: true } | { ok: false; reason: string } {
  if (!ingestToken || ingestToken === "dev-ingest-token-change-me") {
    return {
      ok: false,
      reason:
        "Detailed health is disabled because QEV_INGEST_TOKEN is unset or still the shipped default. Set a real token to enable it.",
    };
  }
  const token = parseAuth(req);
  if (!token) return { ok: false, reason: "Missing Bearer token" };
  const a = Buffer.from(token);
  const b = Buffer.from(ingestToken);
  // Length must match before timingSafeEqual, which throws on mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid Bearer token" };
  }
  return { ok: true };
}


/**
 * Capture gate. See license.ts for why this only ever guards capture.
 *
 * Returns null when the request may proceed, or a 402 response body when it
 * may not. 402 rather than 403: this is a commercial limit, not a security
 * decision, and the distinction matters to anyone reading logs.
 */
let cachedLicense: License | null | undefined;
async function gateCapture(
  action: CaptureAction,
  dataDir: string,
  usage: { packages: number; cases: number },
  res: ServerResponse,
): Promise<boolean> {
  if (cachedLicense === undefined) {
    cachedLicense = await loadLicense(path.join(dataDir, "license.json"));
  }
  const ent = await entitlementForCapture(action, cachedLicense, usage);
  if (ent.allowed) return true;
  json(res, 402, {
    error: "capture_not_entitled",
    action,
    tier: ent.tier,
    reason: ent.reason,
    remedy: ent.remedy,
    evidence_access:
      "Unaffected. Every package already sealed remains readable, verifiable and " +
      "exportable with your own keys. This limit applies to new capture only.",
  });
  return false;
}

function parseSignature(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^sha256=([a-f0-9]+)$/i.exec(header.trim());
  if (m) return m[1]!.toLowerCase();
  if (/^[a-f0-9]{64}$/i.test(header.trim())) return header.trim().toLowerCase();
  return null;
}

/**
 * Single source of truth for the version this gateway reports.
 *
 * The audit found /healthz reporting "0.2.0-pilot" while /v1/health on the
 * same process reported "0.3.0-seamless-p0". Two endpoints on one binary
 * must not disagree about what they are.
 */
const GATEWAY_VERSION = "0.3.0-seamless-p0";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
};

function redactSecrets(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/pass|token|secret|authorization|key/i.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = redactSecrets(v);
    }
  }
  return out;
}

export function createGateway(
  config: GatewayConfig,
  store: GatewayStore,
  queue: DurableQueue,
  caseLog: CaseLog,
  settingsStore: SettingsStore,
  signingKeys: SigningKeyStore,
) {
  async function buildPreflightReport() {
    const q = await queue.stats();
    const chain = await caseLog.verifyChain();
    let storage_writable = false;
    let backup_writable = false;
    try {
      const probe = path.join(config.storageDir, ".write-probe");
      await writeFileFs(probe, "ok");
      await unlink(probe);
      storage_writable = true;
    } catch {
      storage_writable = false;
    }
    try {
      const probe = path.join(config.storageDir, "backup", ".write-probe");
      await mkdir(path.join(config.storageDir, "backup"), { recursive: true });
      await writeFileFs(probe, "ok");
      await unlink(probe);
      backup_writable = true;
    } catch {
      backup_writable = false;
    }

    let package_roundtrip_ok = false;
    try {
      const test = await sealEvidencePackage({
        packageId: "preflight_selftest",
        tenantId: config.tenantId,
        flowId: "field-service",
        caseId: "PREFLIGHT",
        evidenceBundleJson: JSON.stringify({
          schema: "QEV-EVIDENCE-BUNDLE-V1",
          selftest: true,
        }),
        password: config.packagePassphrase,
        publicMeta: {
          event_count: 0,
          outcome: "complete",
          integrity_events_sha256: "0".repeat(64),
        },
        signingKey: signingKeys.get(),
      });
      await openEvidencePackage(test, config.packagePassphrase);
      const sig = await verifyOuterPackageSignature(test);
      package_roundtrip_ok = sig.ok;
    } catch {
      package_roundtrip_ok = false;
    }

    const insecureDefault =
      config.webhookSecret === "dev-webhook-secret-change-me";

    return runPreflight({
      gateway_reachable: true,
      storage_writable,
      backup_writable,
      signing_key_present: true,
      encryption_passphrase_configured: Boolean(config.packagePassphrase),
      webhook_secret_configured: !insecureDefault,
      queue_healthy: q.dead < 100,
      case_log_chain_ok: chain.ok,
      package_roundtrip_ok,
    });
  }

  async function ingestEvent(
    event: QevEventV1,
    opts?: { sealIfComplete?: boolean; passphrase?: string },
  ) {
    if (store.hasEvent(event.event_id)) {
      return {
        event_id: event.event_id,
        status: "duplicate" as const,
        observed_at: event.observed_at,
      };
    }

    const idemp = makeIdempotencyKey({
      tenantId: event.tenant_id,
      connector: event.source.connector,
      providerEventId: event.source.provider_event_id,
      eventId: event.event_id,
      rawBodySha256: event.source.raw_body_sha256,
    });

    const enq = await queue.enqueue({
      kind: "ingest.event",
      payload: { event_id: event.event_id },
      idempotency_key: idemp,
    });
    if (enq.duplicate && store.hasEvent(event.event_id)) {
      return {
        event_id: event.event_id,
        status: "duplicate" as const,
        observed_at: event.observed_at,
      };
    }

    const decision = evaluatePolicy(event, policyForFlow(event.flow_id));
    const finalEvent = applyDecisionToEvent(event, decision);
    await store.putEvent(finalEvent, decision);

    await caseLog.append({
      case_id: finalEvent.case_id,
      flow_id: finalEvent.flow_id,
      kind: "event.accepted",
      event_id: finalEvent.event_id,
      summary: `${finalEvent.action} (${finalEvent.outcome}) via ${finalEvent.source.connector}`,
    });

    // Mark queue job done (sync path for pilot; async worker can claim later)
    if (!enq.duplicate) {
      const claimed = await queue.claimNext();
      if (claimed) await queue.complete(claimed.id);
    }

    let package_id: string | undefined;
    let package_kind: string | undefined;
    let auto_sealed = false;

    if (opts?.sealIfComplete && decision.effect !== "block") {
      const sealed = await sealCase(
        finalEvent.flow_id,
        finalEvent.case_id,
        opts.passphrase ?? config.packagePassphrase,
      );
      package_id = sealed.package_id as string;
      package_kind = sealed.package_kind as string;
    } else if (decision.effect !== "block") {
      // Auto-seal when complete (Increment B)
      const settings = await settingsStore.load();
      if (settings.auto_seal && finalEvent.flow_id === "field-service") {
        const rows = store.getCase(finalEvent.flow_id, finalEvent.case_id);
        const completeness = evaluateCompleteness(
          rows.map((r) => r.event),
          FIELD_SERVICE_PACK,
          finalEvent.case_id,
        );
        const existing = store.getSealRecord(
          finalEvent.flow_id,
          finalEvent.case_id,
        );
        const hasNew = store.unsealedEvents(
          finalEvent.flow_id,
          finalEvent.case_id,
        ).length > 0;
        if (
          completeness.complete_for_seal &&
          (!existing || (settings.supplemental_packages && hasNew))
        ) {
          try {
            const sealed = await sealCase(
              finalEvent.flow_id,
              finalEvent.case_id,
              config.packagePassphrase,
            );
            package_id = sealed.package_id as string;
            package_kind = sealed.package_kind as string;
            auto_sealed = true;
          } catch {
            // incomplete or gate — leave unsealed
          }
        }
      }
    }

    return {
      event_id: finalEvent.event_id,
      status:
        decision.effect === "block"
          ? ("blocked" as const)
          : ("accepted" as const),
      observed_at: finalEvent.observed_at,
      policy_effect: decision.effect,
      policy_reason: decision.reason,
      package_id,
      package_kind,
      auto_sealed,
      shadow_mode: config.shadowMode,
    };
  }

  async function sealCase(flowId: string, caseId: string, passphrase: string) {
    const settings = await settingsStore.load();
    const existingSeal = store.getSealRecord(flowId, caseId);
    const allRows = store.getCase(flowId, caseId);
    if (!allRows.length) {
      throw new Error(`No events for ${flowId}/${caseId}`);
    }

    // Supplemental: only unsealed events after a primary exists
    const isSupplemental = Boolean(existingSeal) && settings.supplemental_packages;
    const rows = isSupplemental
      ? store.unsealedEvents(flowId, caseId)
      : allRows;
    if (isSupplemental && rows.length === 0) {
      // Idempotent re-complete: return primary package metadata, never rewrite
      const primary = await store.loadPackage(existingSeal!.primary_package_id);
      if (!primary) {
        throw new Error("Primary package missing from storage");
      }
      return {
        package_id: primary.package_id,
        package_kind: "primary",
        case_id: caseId,
        flow_id: flowId,
        path: store.packagePath(primary.package_id),
        public_meta: primary.public_meta,
        already_sealed: true,
        note: "Already sealed — no new events; primary package not rewritten.",
      };
    }

    const events = rows.map((r) => r.event);
    const decisions = rows.map((r) => r.decision);

    // Required evidence gaps for field-service (evaluate full case timeline)
    const pack =
      flowId === "field-service" ? FIELD_SERVICE_PACK : undefined;
    const allEvents = allRows.map((r) => r.event);
    if (pack && !isSupplemental) {
      const present = new Set(events.map((e) => e.action));
      for (const req of pack.required_actions) {
        if (!present.has(req)) {
          const last = events[events.length - 1]!;
          last.known_gaps = [
            ...(last.known_gaps ?? []),
            {
              code: "missing_required_action",
              message: `Required action not present: ${req}`,
              severity: "warning",
            },
          ];
        }
      }
    }

    const packageKind = isSupplemental ? "supplemental" : "primary";
    const bundle = buildEvidenceBundle({
      events,
      decisions,
      flowPackVersion: pack?.version ?? "0.1.0",
      title: isSupplemental
        ? `${flowId} ${caseId} (supplemental)`
        : `${flowId} ${caseId}`,
    });
    const verify = verifyEvidenceBundle(bundle);
    if (!verify.overall_ok) {
      throw new Error(`Bundle integrity failed: ${verify.failures.join("; ")}`);
    }

    const completeness =
      flowId === "field-service"
        ? evaluateCompleteness(allEvents, FIELD_SERVICE_PACK, caseId)
        : null;

    const mode = normalizeMode(settings.mode);
    if (completeness && !isSupplemental) {
      const gate = gateWouldBlock({
        mode,
        action: "package.seal",
        hasChangeApproval: allEvents.some((e) => e.action === "change.approved"),
        completenessOk: completeness.complete_for_seal,
      });
      if (gate.would_block) {
        throw new Error(
          `${gate.reason}. Disable gate mode or complete required evidence. Human confirmation required for gate.`,
        );
      }
      if (!completeness.seal_allowed_in_shadow && !completeness.complete_for_seal) {
        throw new Error(
          `Cannot seal: ${completeness.required_missing.join(", ")}`,
        );
      }
    }

    const eventIds = events.map((e) => e.event_id);
    const pkg = await sealEvidencePackage({
      packageId: bundle.package_id,
      tenantId: config.tenantId,
      flowId,
      caseId,
      evidenceBundleJson: JSON.stringify(bundle),
      password: passphrase,
      publicMeta: {
        title: bundle.summary.title,
        event_count: bundle.summary.event_count,
        outcome: bundle.summary.outcome,
        integrity_events_sha256: bundle.integrity.events_sha256,
        package_kind: packageKind,
        parent_package_id: existingSeal?.primary_package_id,
        sealed_event_ids: eventIds,
      },
      preset: "quick",
      signingKey: signingKeys.get(),
    });
    const filePath = await store.savePackage(pkg);

    const sealedIds = new Set([
      ...(existingSeal?.sealed_event_ids ?? []),
      ...eventIds,
    ]);
    await store.recordSeal({
      flow_id: flowId,
      case_id: caseId,
      primary_package_id:
        existingSeal?.primary_package_id ?? pkg.package_id,
      supplemental_package_ids: isSupplemental
        ? [...(existingSeal?.supplemental_package_ids ?? []), pkg.package_id]
        : existingSeal?.supplemental_package_ids ?? [],
      sealed_event_ids: [...sealedIds],
      updated_at: new Date().toISOString(),
    });

    const sealCert = await buildPackageSealCertificate({
      pkg,
      bundle,
      signingKey: signingKeys.get(),
      completeness,
      gatewayVersion: "0.3.0-seamless-p0",
      packageKind,
      parentPackageId: existingSeal?.primary_package_id,
    });
    await store.saveCertificate(sealCert.certificate_id, sealCert);

    await caseLog.append({
      case_id: caseId,
      flow_id: flowId,
      kind: isSupplemental ? "package.supplemental" : "package.sealed",
      package_id: pkg.package_id,
      summary: `${packageKind} package ${pkg.package_id} (${bundle.summary.outcome}) signed=true cert=${sealCert.certificate_id}`,
    });

    return {
      package_id: pkg.package_id,
      package_kind: packageKind,
      parent_package_id: existingSeal?.primary_package_id,
      case_id: caseId,
      flow_id: flowId,
      path: filePath,
      integrity: bundle.integrity,
      public_meta: pkg.public_meta,
      package_signature: pkg.package_signature
        ? {
            algorithm: pkg.package_signature.algorithm,
            key_id: pkg.package_signature.key_id,
            signed_at: pkg.package_signature.signed_at,
          }
        : undefined,
      seal_certificate_id: sealCert.certificate_id,
      verification_claims: verify.claims,
      completeness,
      mode,
      mode_behavior: MODE_BEHAVIORS[mode],
      shadow_mode: mode === "shadow" || config.shadowMode,
      note: isSupplemental
        ? "Supplemental package — primary seal was not rewritten."
        : "Primary seal is immutable. Late events create supplemental packages when enabled.",
    };
  }



  async function serveStatic(
    res: ServerResponse,
    urlPath: string,
  ): Promise<boolean> {
    let rel = urlPath === "/" || urlPath === "/admin" || urlPath === "/admin/"
      ? "/index.html"
      : urlPath.replace(/^\/admin/, "") || "/index.html";
    if (rel.includes("..")) return false;
    const filePath = path.join(config.adminDir, rel);
    try {
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
      return true;
    } catch {
      return false;
    }
  }

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
          "access-control-allow-headers":
            "content-type,authorization,x-qev-signature,x-hub-signature-256",
        });
        res.end();
        return;
      }

      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? "localhost"}`,
      );
      const method = req.method ?? "GET";

      // Static admin / wizard / portal / review
      if (
        method === "GET" &&
        (url.pathname === "/" ||
          url.pathname.startsWith("/admin") ||
          url.pathname.startsWith("/assets") ||
          url.pathname === "/wizard" ||
          url.pathname === "/portal" ||
          url.pathname === "/review")
      ) {
        const mapped =
          url.pathname === "/wizard"
            ? "/wizard.html"
            : url.pathname === "/portal"
              ? "/portal.html"
              : url.pathname === "/review"
                ? "/review.html"
                : url.pathname;
        if (await serveStatic(res, mapped)) return;
      }

      if (method === "GET" && url.pathname === "/healthz") {
        return json(res, 200, {
          status: "ok",
          product: "qev-gateway",
          version: GATEWAY_VERSION,
          claims: "liveness only — not a security proof",
        });
      }

      if (method === "GET" && url.pathname === "/readyz") {
        const q = await queue.stats();
        const chain = await caseLog.verifyChain();
        return json(res, 200, {
          status: "ready",
          storage: config.storageDir,
          queue: q,
          case_log: chain,
        });
      }

      if (method === "GET" && url.pathname === "/v1/status") {
        const settings = await settingsStore.load();
        const q = await queue.stats();
        const chain = await caseLog.verifyChain();
        return json(res, 200, {
          product: "QEV Capture Gateway",
          version: "0.2.0-pilot",
          tenant_id: config.tenantId,
          settings: redactSecrets(settings),
          queue: q,
          case_log: chain,
          connectors: settings.connectors,
          shadow_mode: settings.mode === "shadow" || config.shadowMode,
          data_plane: "customer-controlled",
          plaintext_to_qira: false,
        });
      }

      // --- Settings / wizard (local admin; bearer optional for pilot localhost) ---
      if (method === "GET" && url.pathname === "/v1/settings") {
        return json(res, 200, await settingsStore.load());
      }

      if (method === "PUT" && url.pathname === "/v1/settings") {
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as PilotSettings;
        // Never accept secrets into settings blob
        const cleaned = redactSecrets(body) as PilotSettings;
        void cleaned;

        // Enabling flow requires preflight (Seamless-Use Spec §3.4)
        if (body.enabled) {
          const pf = await buildPreflightReport();
          if (!pf.can_activate) {
            return json(res, 409, {
              error: "Preflight blocked activation",
              preflight: pf,
              human_confirmation_still_required: REQUIRES_HUMAN_CONFIRMATION,
            });
          }
          if (normalizeMode(body.mode) === "gate") {
            // Soft: allow save but flag that gate needs explicit human confirm field
            if (!(body as PilotSettings & { gate_confirmed?: boolean }).gate_confirmed) {
              return json(res, 409, {
                error:
                  "Gate mode requires explicit human confirmation (gate_confirmed: true)",
                human_confirmation_still_required: REQUIRES_HUMAN_CONFIRMATION,
              });
            }
          }
        }

        const saved = await settingsStore.save({
          ...body,
          mode: normalizeMode(body.mode) as PilotSettings["mode"],
          updated_at: new Date().toISOString(),
        });
        return json(res, 200, saved);
      }

      // Preflight detail names internal paths and configuration state.
      // Authenticated only.
      if (method === "GET" && url.pathname === "/v1/preflight") {
        const auth = isDetailAuthorized(req, config.ingestToken);
        if (!auth.ok) return unauthorized(res, auth.reason);
        return json(res, 200, await buildPreflightReport());
      }

      if (method === "GET" && url.pathname === "/v1/health") {
        const settings = await settingsStore.load();
        const auth = isDetailAuthorized(req, config.ingestToken);

        // Public view: enough for an uptime check or a load balancer to
        // route on, and nothing that describes how this gateway is
        // configured. No preflight detail, no connector inventory, no
        // key ids, no queue depths, no case/package counts.
        if (!auth.ok) {
          const pf = await buildPreflightReport();
          return json(res, 200, {
            product: "qev-gateway",
            version: GATEWAY_VERSION,
            mode: normalizeMode(settings.mode),
            enabled: settings.enabled,
            // A boolean roll-up, not the per-check detail. Says whether
            // the gateway believes it can operate, without describing
            // its internals.
            healthy: pf.critical_failures === 0,
            // Entitlement state is deliberately public: a customer should be
            // able to see what tier they are on without a token, and it
            // contains no secret.
            entitlement: licenseSummary(
              cachedLicense ?? null,
              { packages: (await store.listPackages()).length, cases: store.listCases().length },
            ),
            detail: "authenticate with a Bearer token for the full report",
            plaintext_to_qira: false,
          });
        }

        const pf = await buildPreflightReport();
        const q = await queue.stats();
        const chain = await caseLog.verifyChain();
        return json(res, 200, {
          product: "qev-gateway",
          version: GATEWAY_VERSION,
          mode: normalizeMode(settings.mode),
          mode_behavior: MODE_BEHAVIORS[normalizeMode(settings.mode)],
          enabled: settings.enabled,
          preflight: pf,
          queue: q,
          case_log: chain,
          signing: signingKeys.publicInfo(),
          connectors: settings.connectors,
          cases: store.listCases().length,
          packages: (await store.listPackages()).length,
          requires_human_confirmation: REQUIRES_HUMAN_CONFIRMATION,
          entitlement: licenseSummary(
            cachedLicense ?? null,
            { packages: (await store.listPackages()).length, cases: store.listCases().length },
          ),
          plaintext_to_qira: false,
        });
      }

      if (method === "POST" && url.pathname === "/v1/match") {
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          explicit_case_id?: string;
          provider_object_id?: string;
          invoice_ref?: string;
          email_subject?: string;
          folder_path?: string;
          artifact_name?: string;
        };
        const known = store.listCases().map((c) => c.case_id);
        return json(
          res,
          200,
          matchCase({
            ...body,
            known_case_ids: known,
          }),
        );
      }


      // --- Signed webhook ---
      const webhookMatch = url.pathname.match(/^\/v1\/webhooks\/([^/]+)$/);
      if (method === "POST" && webhookMatch) {
        const connectorId = decodeURIComponent(webhookMatch[1]!);
        const rawBuf = await readBody(req);
        const rawBody = rawBuf.toString("utf8");
        const sig = parseSignature(
          (req.headers["x-qev-signature"] as string | undefined) ??
            (req.headers["x-hub-signature-256"] as string | undefined),
        );
        if (!sig) {
          return unauthorized(res, "Missing X-QEV-Signature header");
        }
        const expected = hmacSha256Hex(config.webhookSecret, rawBody);
        if (!timingSafeEqualHex(sig, expected)) {
          return unauthorized(res, "Invalid webhook signature");
        }

        let body: GenericWebhookBody;
        try {
          body = JSON.parse(rawBody) as GenericWebhookBody;
        } catch {
          return json(res, 400, { error: "Invalid JSON body" });
        }

        const event = normalizeGenericWebhook({
          body,
          rawBody,
          tenantId: config.tenantId,
          connectorId,
          defaultFlowId: "field-service",
        });
        const receipt = await ingestEvent(event, {
          sealIfComplete: body.payload?.seal === true,
        });
        return json(res, 202, {
          ...receipt,
          raw_body_sha256: sha256Hex(rawBody),
          signature_valid: true,
          claims: [
            "Webhook HMAC-SHA256 signature is valid for the shared secret",
            "Raw body SHA-256 is bound on the event",
            "Event was normalized to qev.event.v1",
          ],
        });
      }

      // --- Auth for remaining /v1 mutating (portal allows limited open for pilot UX) ---
      const openPortal =
        method === "POST" &&
        (url.pathname.startsWith("/v1/portal/") ||
          url.pathname === "/v1/photos");

      if (url.pathname.startsWith("/v1/") && !openPortal) {
        const isGetPublic =
          method === "GET" &&
          (url.pathname.startsWith("/v1/packages") ||
            url.pathname.startsWith("/v1/cases") ||
            url.pathname === "/v1/settings" ||
            url.pathname === "/v1/status" ||
            url.pathname.startsWith("/v1/receipts") ||
            url.pathname === "/v1/queue" ||
            url.pathname === "/v1/flow-pack");
        if (!isGetPublic) {
          const token = parseAuth(req);
          if (
            token !== config.ingestToken &&
            !(method === "PUT" && url.pathname === "/v1/settings")
          ) {
            // settings PUT allowed on localhost pilot without token for wizard UX
            if (!(method === "PUT" && url.pathname === "/v1/settings")) {
              return unauthorized(res, "Invalid or missing Bearer token");
            }
          }
        }
      }

      if (method === "GET" && url.pathname === "/v1/flow-pack") {
        return json(res, 200, FIELD_SERVICE_PACK);
      }

      if (method === "GET" && url.pathname === "/v1/certificates") {
        return json(res, 200, {
          certificates: await store.listCertificates(),
          note: "Package seal certificates and pilot trust certificates. Badge graphics prove nothing.",
        });
      }

      const certMatch = url.pathname.match(/^\/v1\/certificates\/([^/]+)$/);
      if (method === "GET" && certMatch) {
        const id = decodeURIComponent(certMatch[1]!);
        const cert = await store.loadCertificate(id);
        if (!cert) return json(res, 404, { error: "certificate not found" });
        return json(res, 200, cert);
      }

      if (method === "POST" && url.pathname === "/v1/trust/issue-pilot") {
        const token = parseAuth(req);
        if (token !== config.ingestToken) {
          return unauthorized(res, "Invalid or missing Bearer token");
        }
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          legal_name?: string;
          domain?: string;
          level?: "qev_compatible" | "qev_pilot_configuration_passed";
        };
        const pf = await buildPreflightReport();
        if (!pf.can_activate && body.level !== "qev_compatible") {
          return json(res, 409, {
            error: "Preflight must pass for pilot configuration certificate",
            preflight: pf,
          });
        }
        try {
          const cert = await issueWorkflowCertificate({
            level: body.level ?? "qev_pilot_configuration_passed",
            legal_name: body.legal_name ?? "Local pilot tenant",
            domain: body.domain ?? "localhost",
            workspace: "Field Operations",
            environment: "development",
            flow_id: "field-service",
            flow_version: FIELD_SERVICE_PACK.version,
            included_systems: [
              "QEV Job Portal",
              "Photo & File",
              "Generic Webhook",
            ],
            excluded_systems: [
              "Payroll",
              "General corporate email",
              "Unconnected systems",
            ],
            scope_sentence:
              "Field-service estimates, approvals, job photos, change orders, invoices, and completion records.",
            controls: {
              package_encryption: "pass",
              package_signature: "pass",
              missing_evidence_visibility: "pass",
              connector_health: pf.can_activate ? "pass" : "fail",
              backup_restore_test: "not_tested",
              key_rotation_policy: "not_tested",
              independent_audit: "n_a",
            },
            exceptions: [
              "Controlled-use / pilot only",
              "Not QEV Protected Workflow (requires continuous production controls)",
              "Not independently assessed",
              "No KMS/HSM; local signing key",
            ],
            signingKey: signingKeys.get(),
            ttl_days: 30,
          });
          await store.saveCertificate(cert.certificate_id, cert);
          const svg = badgeSvg({
            label: cert.public_label,
            scope_short: cert.scope.scope_sentence.slice(0, 60) + "…",
            status: cert.status,
            verify_url: `/v1/certificates/${cert.certificate_id}`,
          });
          return json(res, 201, {
            certificate: cert,
            badge_svg: svg,
            issuable_levels_now: ISSUABLE_NOW,
            note: "Badge image is decorative. Certificate + status are the trust object.",
          });
        } catch (e) {
          return json(res, 400, {
            error: e instanceof Error ? e.message : String(e),
            issuable_levels_now: ISSUABLE_NOW,
          });
        }
      }

      if (method === "GET" && url.pathname === "/v1/queue") {
        return json(res, 200, {
          stats: await queue.stats(),
          dead: await queue.listDead(),
        });
      }

      if (method === "POST" && url.pathname.startsWith("/v1/queue/replay/")) {
        const jobId = decodeURIComponent(
          url.pathname.slice("/v1/queue/replay/".length),
        );
        const ok = await queue.replayDead(jobId);
        return json(res, ok ? 200 : 404, { ok });
      }

      if (method === "GET" && url.pathname === "/v1/cases") {
        const flow = url.searchParams.get("flow") ?? undefined;
        return json(res, 200, { cases: store.listCases(flow) });
      }

      if (method === "GET" && url.pathname.startsWith("/v1/cases/")) {
        const rest = url.pathname.slice("/v1/cases/".length);
        const [flowId, caseId] = rest.split("/").map(decodeURIComponent);
        if (!flowId || !caseId) {
          return json(res, 400, { error: "flow_id/case_id required" });
        }
        const rows = store.getCase(flowId, caseId);
        const log = await caseLog.listForCase(caseId);
        const events = rows.map((r) => r.event);
        const completeness =
          flowId === "field-service"
            ? evaluateCompleteness(events, FIELD_SERVICE_PACK, caseId)
            : null;
        return json(res, 200, {
          flow_id: flowId,
          case_id: caseId,
          events,
          decisions: rows.map((r) => r.decision),
          case_log: log,
          completeness,
        });
      }


      // Job portal: create lifecycle events without raw YAML
      if (method === "POST" && url.pathname === "/v1/portal/events") {
        // Capture is gateable; reading evidence is not. See license.ts.
        if (!(await gateCapture("portal_event", config.dataDir,
              { packages: (await store.listPackages()).length, cases: store.listCases().length }, res))) return;
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          case_id: string;
          action: string;
          actor?: { id?: string; display_name?: string };
          outcome?: QevEventV1["outcome"];
          payload?: Record<string, unknown>;
          artifacts?: QevEventV1["artifacts"];
          occurred_at?: string;
        };
        if (!body.case_id || !body.action) {
          return json(res, 400, { error: "case_id and action required" });
        }
        const now = new Date().toISOString();
        const event: QevEventV1 = {
          schema: "qev.event.v1",
          event_id: newId("portal"),
          occurred_at: body.occurred_at ?? now,
          observed_at: now,
          tenant_id: config.tenantId,
          flow_id: "field-service",
          case_id: body.case_id,
          source: {
            system: "qev-job-portal",
            connector: "job-portal",
            connector_version: "0.1.0",
            ingestion_path: "sdk",
          },
          actor: {
            id: body.actor?.id ?? "portal-user",
            display_name: body.actor?.display_name,
            identity_assurance: "source_asserted",
          },
          action: body.action,
          outcome: body.outcome ?? "success",
          artifacts: body.artifacts,
          privacy: {
            default_mode: "full",
            field_modes: (await settingsStore.load()).privacy.field_modes as never,
          },
          payload: body.payload ?? {},
          known_gaps: [],
          time_assurance: { gateway_receipt_time: now },
        };
        const receipt = await ingestEvent(event);
        return json(res, 202, receipt);
      }

      // Photo / file upload (base64 for pilot simplicity)
      if (method === "POST" && url.pathname === "/v1/photos") {
        // Capture is gateable; reading evidence is not. See license.ts.
        if (!(await gateCapture("upload_photo", config.dataDir,
              { packages: (await store.listPackages()).length, cases: store.listCases().length }, res))) return;
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          case_id: string;
          kind: "before" | "after" | "receipt" | "other";
          filename: string;
          content_base64: string;
          actor?: { id?: string };
        };
        if (!body.case_id || !body.filename || !body.content_base64) {
          return json(res, 400, {
            error: "case_id, filename, content_base64 required",
          });
        }
        const buf = Buffer.from(body.content_base64, "base64");
        const sha256 = createHash("sha256").update(buf).digest("hex");
        const artDir = path.join(store.artifactsDir(), body.case_id);
        await mkdir(artDir, { recursive: true });
        const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const dest = path.join(artDir, `${sha256.slice(0, 12)}_${safeName}`);
        await writeFile(dest, buf);

        const action =
          body.kind === "before"
            ? "evidence.before_captured"
            : body.kind === "after"
              ? "evidence.after_captured"
              : "evidence.file_captured";
        const now = new Date().toISOString();
        const event: QevEventV1 = {
          schema: "qev.event.v1",
          event_id: newId("photo"),
          occurred_at: now,
          observed_at: now,
          tenant_id: config.tenantId,
          flow_id: "field-service",
          case_id: body.case_id,
          source: {
            system: "photo-file",
            connector: "photo-file",
            connector_version: "0.1.0",
            ingestion_path: "file",
          },
          actor: {
            id: body.actor?.id ?? "field-tech",
            identity_assurance: "source_asserted",
          },
          action,
          outcome: "success",
          artifacts: [
            {
              name: safeName,
              sha256,
              size_bytes: buf.byteLength,
              media_type: "application/octet-stream",
              uri: `file://${dest}`,
            },
          ],
          privacy: { default_mode: "full" },
          payload: {
            kind: body.kind,
            stored_path: dest,
            note: "File stored in customer-controlled gateway artifacts folder",
          },
          known_gaps: [],
          time_assurance: { gateway_receipt_time: now },
        };
        const receipt = await ingestEvent(event);
        return json(res, 202, {
          ...receipt,
          artifact: { name: safeName, sha256, size_bytes: buf.byteLength },
        });
      }

      if (method === "POST" && url.pathname === "/v1/events") {
        // Capture is gateable; reading evidence is not. See license.ts.
        if (!(await gateCapture("ingest_event", config.dataDir,
              { packages: (await store.listPackages()).length, cases: store.listCases().length }, res))) return;
        const rawBuf = await readBody(req);
        const parsed = JSON.parse(rawBuf.toString("utf8")) as {
          event: QevEventV1;
          seal_if_complete?: boolean;
        };
        const event = {
          ...parsed.event,
          tenant_id: config.tenantId,
          observed_at: parsed.event.observed_at ?? new Date().toISOString(),
        };
        assertQevEventV1(event);
        if (!event.source.ingestion_path) {
          event.source.ingestion_path = "sdk";
        }
        const receipt = await ingestEvent(event, {
          sealIfComplete: parsed.seal_if_complete,
        });
        return json(res, 202, receipt);
      }

      const completeMatch = url.pathname.match(
        /^\/v1\/flows\/([^/]+)\/complete$/,
      );
      if (method === "POST" && completeMatch) {
        const flowId = decodeURIComponent(completeMatch[1]!);
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          case_id: string;
          passphrase?: string;
        };
        if (!body.case_id) {
          return json(res, 400, { error: "case_id required" });
        }
        const result = await sealCase(
          flowId,
          body.case_id,
          body.passphrase ?? config.packagePassphrase,
        );
        return json(res, 201, result);
      }

      if (method === "GET" && url.pathname === "/v1/packages") {
        return json(res, 200, { packages: await store.listPackages() });
      }

      const packageMatch = url.pathname.match(/^\/v1\/packages\/([^/]+)$/);
      if (method === "GET" && packageMatch) {
        const packageId = decodeURIComponent(packageMatch[1]!);
        const pkg = await store.loadPackage(packageId);
        if (!pkg) return json(res, 404, { error: "package not found" });
        return json(res, 200, {
          package_id: pkg.package_id,
          schema: pkg.schema,
          tenant_id: pkg.tenant_id,
          flow_id: pkg.flow_id,
          case_id: pkg.case_id,
          created_at: pkg.created_at,
          public_meta: pkg.public_meta,
          vault_schema: pkg.vault.schema,
          vault_sha256: pkg.vault_sha256,
          path: store.packagePath(packageId),
          note: "Plaintext is not returned. Use verify with passphrase.",
        });
      }

      const verifyMatch = url.pathname.match(
        /^\/v1\/packages\/([^/]+)\/verify$/,
      );
      if (method === "POST" && verifyMatch) {
        const packageId = decodeURIComponent(verifyMatch[1]!);
        const rawBuf = await readBody(req);
        const body = JSON.parse(rawBuf.toString("utf8")) as {
          passphrase: string;
        };
        const pkg = await store.loadPackage(packageId);
        if (!pkg) return json(res, 404, { error: "package not found" });
        const report = await verifyPackageFull(pkg, body.passphrase, config);
        return json(res, 200, report);
      }

      const receiptMatch = url.pathname.match(/^\/v1\/receipts\/([^/]+)$/);
      if (method === "GET" && receiptMatch) {
        const eventId = decodeURIComponent(receiptMatch[1]!);
        const row = store.getEvent(eventId);
        if (!row) return json(res, 404, { error: "event not found" });
        return json(res, 200, {
          event_id: row.event.event_id,
          observed_at: row.event.observed_at,
          policy: row.decision,
          source: row.event.source,
        });
      }

      return json(res, 404, { error: "not found" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Never echo secrets
      return json(res, 500, {
        error: message.replace(/passphrase|token|secret/gi, "[redacted]"),
      });
    }
  });

  return { server, ingestEvent, sealCase, store };
}

export async function verifyPackageFull(
  pkg: QevPackageFile,
  passphrase: string,
  config: GatewayConfig,
) {
  let opened: { evidenceJson: string; vault_sha256_ok: boolean };
  try {
    opened = await openEvidencePackage(pkg, passphrase);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      package_id: pkg.package_id,
      vault_sha256_ok: false,
      decrypt_ok: false,
      vault_schema: pkg.vault.schema,
      failures: [message],
      overall_ok: false,
      claims: [],
      does_not_prove: [
        "anything — decrypt failed (wrong passphrase or corrupted vault)",
      ],
    };
  }
  const bundle = JSON.parse(opened.evidenceJson) as EvidenceBundleV1;
  const bundleReport = verifyEvidenceBundle(bundle);
  const outerSig = await verifyOuterPackageSignature(pkg);
  const multi = buildMultiVerdict({
    pkg,
    bundle,
    vault_sha256_ok: opened.vault_sha256_ok,
    decrypt_ok: true,
    flowPack:
      pkg.flow_id === "field-service" ? FIELD_SERVICE_PACK : undefined,
    shadow_mode: config.shadowMode,
    package_signer: {
      level: outerSig.level,
      detail: outerSig.detail,
    },
  });

  return {
    package_id: pkg.package_id,
    vault_sha256_ok: opened.vault_sha256_ok,
    decrypt_ok: true,
    vault_schema: pkg.vault.schema,
    package_signer: outerSig,
    bundle: bundleReport,
    multi_verdict: multi,
    claims: multi.lines
      .filter((l) => l.level === "verified")
      .map((l) => `${l.label}: ${l.detail}`),
    failures: [
      ...(opened.vault_sha256_ok ? [] : ["vault_sha256 mismatch"]),
      ...(outerSig.level === "failed" ? [outerSig.detail] : []),
      ...bundleReport.failures,
    ],
    overall_ok:
      opened.vault_sha256_ok &&
      bundleReport.overall_ok &&
      outerSig.level !== "failed",
    does_not_prove: multi.overall_not_safe_to_rely_for,
  };
}

/** Back-compat for tests */
export async function verifyPackage(pkg: QevPackageFile, passphrase: string) {
  return verifyPackageFull(pkg, passphrase, {
    shadowMode: true,
  } as GatewayConfig);
}
