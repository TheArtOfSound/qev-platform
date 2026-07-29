import { newId, sha256Hex } from "@imagineqira/qev-shared";
import type { QevEventV1, Outcome } from "./types.js";

/**
 * Generic signed-webhook normalizer.
 * Vendor-specific connectors extend this; generic path expects a minimal envelope:
 *
 * {
 *   "flow_id": "devops-change",
 *   "case_id": "CHG-42",
 *   "action": "deployment.completed",
 *   "actor": { "id": "alice@acme.com" },
 *   "outcome": "success",
 *   "payload": { ... },
 *   "artifacts": [{ "name": "...", "sha256": "..." }]
 * }
 */
export interface GenericWebhookBody {
  flow_id?: string;
  case_id?: string;
  action?: string;
  actor?: { id?: string; display_name?: string };
  outcome?: Outcome;
  target?: QevEventV1["target"];
  payload?: Record<string, unknown>;
  artifacts?: QevEventV1["artifacts"];
  occurred_at?: string;
  provider_event_id?: string;
  known_gaps?: QevEventV1["known_gaps"];
}

export function normalizeGenericWebhook(opts: {
  body: GenericWebhookBody;
  rawBody: string;
  tenantId: string;
  connectorId: string;
  connectorVersion?: string;
  defaultFlowId?: string;
}): QevEventV1 {
  const { body, rawBody, tenantId, connectorId } = opts;
  const now = new Date().toISOString();
  const case_id = body.case_id ?? body.payload?.case_id;
  if (typeof case_id !== "string" || !case_id) {
    throw new Error("Webhook body requires case_id");
  }
  const action = body.action ?? "webhook.received";
  const actorId = body.actor?.id ?? "unknown";

  const event: QevEventV1 = {
    schema: "qev.event.v1",
    event_id: body.provider_event_id
      ? `wh_${connectorId}_${body.provider_event_id}`
      : newId("evt"),
    occurred_at: body.occurred_at ?? now,
    observed_at: now,
    tenant_id: tenantId,
    flow_id: body.flow_id ?? opts.defaultFlowId ?? "devops-change",
    case_id: String(case_id),
    source: {
      system: connectorId,
      connector: "generic-webhook",
      connector_version: opts.connectorVersion ?? "0.1.0",
      provider_event_id: body.provider_event_id,
      raw_body_sha256: sha256Hex(rawBody),
      ingestion_path: "webhook",
    },
    actor: {
      id: actorId,
      display_name: body.actor?.display_name,
      identity_assurance: body.actor?.id ? "source_asserted" : "typed",
    },
    action,
    target: body.target,
    outcome: body.outcome ?? "unknown",
    artifacts: body.artifacts,
    privacy: {
      default_mode: "full",
      field_modes: {},
    },
    payload: body.payload ?? {},
    known_gaps: body.known_gaps ?? [],
    time_assurance: {
      ...(body.occurred_at ? { source_system_time: body.occurred_at } : {}),
      gateway_receipt_time: now,
    },
  };

  if (!body.artifacts?.length) {
    event.known_gaps = [
      ...(event.known_gaps ?? []),
      {
        code: "missing_artifacts",
        message: "No artifact fingerprints were supplied with this event.",
        severity: "warning",
      },
    ];
  }

  return event;
}
