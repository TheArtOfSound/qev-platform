import type { PolicyEffect, QevEventV1 } from "@imagineqira/qev-event-schema";

export interface PolicyDecision {
  policy_id: string;
  policy_version: string;
  effect: PolicyEffect;
  reason: string;
  event_id: string;
  decided_at: string;
}

export interface PolicyRule {
  id: string;
  when: {
    flow_id?: string;
    action_includes?: string[];
    outcome?: string[];
    require_artifacts?: boolean;
    block_if_destructive_without_backup?: boolean;
  };
  effect: PolicyEffect;
  reason: string;
}

export interface FlowPolicy {
  policy_id: string;
  policy_version: string;
  rules: PolicyRule[];
  default_effect: PolicyEffect;
}

/** Field service pilot policy — shadow-friendly; gate rules are explicit later. */
export const FIELD_SERVICE_POLICY_V1: FlowPolicy = {
  policy_id: "field-service",
  policy_version: "1.0.0",
  default_effect: "allow_and_record",
  rules: [
    {
      id: "record-scope-change",
      when: {
        flow_id: "field-service",
        action_includes: ["scope.changed"],
      },
      effect: "allow_and_record",
      reason: "Scope change recorded; change.approved expected before added work (gate mode later).",
    },
    {
      id: "record-approvals",
      when: {
        flow_id: "field-service",
        action_includes: ["estimate.approved", "change.approved"],
      },
      effect: "allow_and_record",
      reason: "Customer approval recorded with source-asserted identity.",
    },
  ],
};

/** DevOps change MVP policy — versioned and explicit. */
export const DEVOPS_CHANGE_POLICY_V1: FlowPolicy = {
  policy_id: "devops-change",
  policy_version: "1.0.0",
  default_effect: "allow_and_record",
  rules: [
    {
      id: "block-destroy-without-backup",
      when: {
        flow_id: "devops-change",
        action_includes: ["destroy", "delete", "infra.destroy"],
        block_if_destructive_without_backup: true,
      },
      effect: "block",
      reason: "Destructive production action without recorded backup evidence.",
    },
    {
      id: "require-approval-for-prod-deploy",
      when: {
        flow_id: "devops-change",
        action_includes: ["deployment.production", "deploy.prod"],
      },
      effect: "require_approval",
      reason: "Production deployment requires recorded approval.",
    },
    {
      id: "warn-missing-artifacts",
      when: {
        flow_id: "devops-change",
        require_artifacts: true,
      },
      effect: "allow_and_record",
      reason: "Event accepted; missing artifact fingerprints noted as gaps.",
    },
  ],
};

export function policyForFlow(flowId: string): FlowPolicy {
  if (flowId === "field-service") return FIELD_SERVICE_POLICY_V1;
  return DEVOPS_CHANGE_POLICY_V1;
}

export function evaluatePolicy(
  event: QevEventV1,
  policy?: FlowPolicy,
): PolicyDecision {
  policy = policy ?? policyForFlow(event.flow_id);
  const decided_at = new Date().toISOString();
  const payload = event.payload ?? {};
  const hasBackup =
    payload.backup_status === "ok" ||
    payload.backup_verified === true ||
    (event.artifacts ?? []).some((a) => a.name.includes("backup"));

  for (const rule of policy.rules) {
    if (rule.when.flow_id && rule.when.flow_id !== event.flow_id) continue;

    if (rule.when.action_includes?.length) {
      const hit = rule.when.action_includes.some((frag) =>
        event.action.toLowerCase().includes(frag.toLowerCase()),
      );
      if (!hit) continue;
    }

    if (rule.when.outcome?.length && !rule.when.outcome.includes(event.outcome)) {
      continue;
    }

    if (rule.when.block_if_destructive_without_backup && !hasBackup) {
      return {
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
        effect: rule.effect,
        reason: rule.reason,
        event_id: event.event_id,
        decided_at,
      };
    }

    if (rule.when.require_artifacts) {
      // Informational only when fingerprints are missing; never block here.
      if (!(event.artifacts && event.artifacts.length > 0)) {
        return {
          policy_id: policy.policy_id,
          policy_version: policy.policy_version,
          effect: rule.effect,
          reason: rule.reason,
          event_id: event.event_id,
          decided_at,
        };
      }
      continue;
    }

    if (!rule.when.block_if_destructive_without_backup) {
      return {
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
        effect: rule.effect,
        reason: rule.reason,
        event_id: event.event_id,
        decided_at,
      };
    }
  }

  return {
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    effect: policy.default_effect,
    reason: "Default policy: record event.",
    event_id: event.event_id,
    decided_at,
  };
}

export function applyDecisionToEvent(
  event: QevEventV1,
  decision: PolicyDecision,
): QevEventV1 {
  const next: QevEventV1 = {
    ...event,
    policy: {
      policy_id: decision.policy_id,
      policy_version: decision.policy_version,
      effect: decision.effect,
      reason: decision.reason,
    },
  };
  if (decision.effect === "block") {
    next.outcome = "blocked";
  }
  return next;
}
