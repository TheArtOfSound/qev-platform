/**
 * Operating hierarchy from Seamless-Use Spec §2.
 * Types only for P0 — persistence expands later.
 */
export type EnvironmentName = "development" | "test" | "staging" | "production";

export interface Tenant {
  tenant_id: string;
  name: string;
}

export interface Workspace {
  workspace_id: string;
  tenant_id: string;
  name: string;
}

export interface Environment {
  environment: EnvironmentName;
  workspace_id: string;
}

/** Human confirmation still required for these actions (spec § human rules). */
export const REQUIRES_HUMAN_CONFIRMATION = [
  "connect_new_system_broad_permissions",
  "enable_gate_mode",
  "enable_irreversible_retention_lock",
  "grant_external_reviewer_access",
  "delete_evidence_package",
  "privacy_redacted_to_full_sensitive",
  "production_go_live_after_shadow",
] as const;
