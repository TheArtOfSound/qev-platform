import type { QevEventV1 } from "@imagineqira/qev-event-schema";
import type { FlowPack } from "@imagineqira/qev-trust";

export interface CompletenessReport {
  flow_id: string;
  case_id: string;
  required_total: number;
  required_present: number;
  required_missing: string[];
  optional_present: string[];
  optional_missing: string[];
  complete_for_seal: boolean;
  /** Shadow/record may seal incomplete; gate would refuse when hard-enabled. */
  seal_allowed_in_shadow: boolean;
  percent: number;
  messages: string[];
}

export function evaluateCompleteness(
  events: QevEventV1[],
  pack: FlowPack,
  caseId: string,
): CompletenessReport {
  const present = new Set(events.map((e) => e.action));
  const required_missing = pack.required_actions.filter((a) => !present.has(a));
  const optional_present = pack.optional_actions.filter((a) => present.has(a));
  const optional_missing = pack.optional_actions.filter((a) => !present.has(a));
  const required_present = pack.required_actions.length - required_missing.length;
  const percent =
    pack.required_actions.length === 0
      ? 100
      : Math.round((required_present / pack.required_actions.length) * 100);

  const messages: string[] = [];
  if (required_missing.length) {
    messages.push(
      `Missing required evidence: ${required_missing.join(", ")}`,
    );
  } else {
    messages.push("All required flow actions are present.");
  }
  if (present.has("scope.changed") && !present.has("change.approved")) {
    messages.push(
      "Scope was changed without change.approved — record this as a known gap.",
    );
  }

  return {
    flow_id: pack.id,
    case_id: caseId,
    required_total: pack.required_actions.length,
    required_present,
    required_missing,
    optional_present,
    optional_missing,
    complete_for_seal: required_missing.length === 0,
    seal_allowed_in_shadow: pack.seal_policy.allow_incomplete || required_missing.length === 0,
    percent,
    messages,
  };
}
