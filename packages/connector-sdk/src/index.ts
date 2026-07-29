import type { QevEventV1 } from "@imagineqira/qev-event-schema";

export interface ConnectorManifest {
  name: string;
  version: string;
  vendor: string;
  mode: "webhook" | "otlp" | "poll" | "file" | "proxy";
  event_types: string[];
  permissions: string[];
  privacy_warning?: string;
  setup_steps: string[];
  required_outbound_hosts?: string[];
}

export interface RawProviderEvent {
  id?: string;
  received_at: string;
  headers?: Record<string, string>;
  body: unknown;
  raw_body?: string;
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConnectorHealth {
  status: "healthy" | "degraded" | "down";
  last_event_at?: string;
  message?: string;
}

/**
 * Contract every production connector must implement.
 * Generic webhook implements a subset for MVP.
 */
export interface QEVConnector {
  manifest(): ConnectorManifest;
  test(): Promise<ConnectionTest>;
  normalize(raw: RawProviderEvent): Promise<QevEventV1[]>;
  health(): Promise<ConnectorHealth>;
  close(): Promise<void>;
}

export const GENERIC_WEBHOOK_MANIFEST: ConnectorManifest = {
  name: "generic-webhook",
  version: "0.1.0",
  vendor: "imagineqira",
  mode: "webhook",
  event_types: ["*"],
  permissions: ["receive_signed_webhook"],
  privacy_warning:
    "Raw webhook bodies are hashed; payload fields follow flow privacy modes.",
  setup_steps: [
    "Copy the gateway webhook URL for this connector.",
    "Configure the source system to sign requests with the shared secret.",
    "Send a test event and review the draft package.",
  ],
};
