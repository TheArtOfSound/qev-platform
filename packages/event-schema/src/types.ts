export type PrivacyMode =
  | "full"
  | "redacted"
  | "hash_only"
  | "reference_only"
  | "drop";

export type IdentityAssurance =
  | "typed"
  | "source_asserted"
  | "company_sso"
  | "cryptographically_signed"
  | "device_bound";

export type Outcome = "success" | "failure" | "pending" | "blocked" | "unknown";

export type PolicyEffect =
  | "allow"
  | "allow_and_record"
  | "require_approval"
  | "block";

export type IngestionPath =
  | "webhook"
  | "otlp"
  | "sdk"
  | "poll"
  | "file"
  | "proxy";

export interface QevArtifact {
  name: string;
  sha256: string;
  media_type?: string;
  size_bytes?: number;
  uri?: string;
}

export interface QevKnownGap {
  code: string;
  message: string;
  field?: string;
  severity?: "info" | "warning" | "critical";
}

export interface QevEventV1 {
  schema: "qev.event.v1";
  event_id: string;
  occurred_at: string;
  observed_at: string;
  tenant_id: string;
  flow_id: string;
  case_id: string;
  source: {
    system: string;
    connector: string;
    connector_version: string;
    provider_event_id?: string;
    raw_body_sha256?: string;
    ingestion_path?: IngestionPath;
  };
  actor: {
    id: string;
    display_name?: string;
    identity_assurance: IdentityAssurance;
    auth_context?: string;
  };
  action: string;
  target?: {
    type?: string;
    id?: string;
    name?: string;
    [k: string]: unknown;
  };
  outcome: Outcome;
  artifacts?: QevArtifact[];
  policy?: {
    policy_id: string;
    policy_version: string;
    effect: PolicyEffect;
    reason?: string;
  };
  privacy: {
    default_mode: PrivacyMode;
    field_modes?: Record<string, PrivacyMode>;
  };
  payload?: Record<string, unknown>;
  known_gaps?: QevKnownGap[];
  time_assurance?: {
    source_system_time?: string;
    gateway_receipt_time?: string;
    org_signed_time?: string;
    independent_timestamp?: string;
  };
  connector_signature?: {
    algorithm: string;
    key_id: string;
    signature: string;
  };
}

export interface EvidenceBundleV1 {
  schema: "QEV-EVIDENCE-BUNDLE-V1";
  package_id: string;
  created_at: string;
  tenant_id: string;
  flow_id: string;
  case_id: string;
  flow_pack_version?: string;
  events: QevEventV1[];
  summary: {
    event_count: number;
    outcome: "complete" | "incomplete" | "blocked" | "failed";
    title?: string;
    questions: Array<{
      id: string;
      question: string;
      answerable: boolean;
      evidence_event_ids?: string[];
      note?: string;
    }>;
  };
  artifacts?: QevArtifact[];
  policy_decisions?: Array<{
    policy_id: string;
    policy_version: string;
    effect: string;
    reason?: string;
    event_id: string;
    decided_at?: string;
  }>;
  known_gaps: QevKnownGap[];
  access_policy?: {
    retention?: string;
    authorized_roles?: string[];
    legal_hold?: boolean;
  };
  integrity: {
    events_sha256: string;
    bundle_sha256: string;
    algorithm?: "SHA-256";
  };
  package_signature?: {
    algorithm: string;
    key_id: string;
    signature: string;
  };
}
