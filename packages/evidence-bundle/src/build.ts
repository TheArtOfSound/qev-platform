import { newId, sha256Canonical, canonicalJSON } from "@imagineqira/qev-shared";
import type {
  EvidenceBundleV1,
  QevEventV1,
  QevKnownGap,
} from "@imagineqira/qev-event-schema";
import type { PolicyDecision } from "@imagineqira/qev-policy-engine";

/** Investigation questions for the devops-change flow pack. */
export const DEVOPS_QUESTIONS = [
  {
    id: "who",
    question: "Who initiated the change?",
  },
  {
    id: "what",
    question: "What action was performed?",
  },
  {
    id: "artifacts",
    question: "What artifacts were fingerprinted?",
  },
  {
    id: "policy",
    question: "What policy effect applied?",
  },
  {
    id: "outcome",
    question: "What was the outcome?",
  },
] as const;

export const FIELD_SERVICE_QUESTIONS = [
  { id: "job", question: "What job is this?" },
  { id: "estimate", question: "Who approved the estimate?" },
  { id: "before", question: "Were before photos captured?" },
  { id: "scope", question: "Was scope changed, and was the change approved?" },
  { id: "after", question: "Were after photos captured?" },
  { id: "gaps", question: "What evidence is missing?" },
  { id: "seal", question: "Did the package change after sealing?" },
] as const;

export function buildEvidenceBundle(opts: {
  events: QevEventV1[];
  decisions?: PolicyDecision[];
  packageId?: string;
  flowPackVersion?: string;
  title?: string;
}): EvidenceBundleV1 {
  if (!opts.events.length) {
    throw new Error("Cannot build evidence bundle with zero events");
  }
  const first = opts.events[0]!;
  const package_id = opts.packageId ?? newId("pkg");
  const created_at = new Date().toISOString();

  const known_gaps: QevKnownGap[] = [];
  for (const e of opts.events) {
    for (const g of e.known_gaps ?? []) {
      known_gaps.push(g);
    }
  }

  const blocked = opts.events.some((e) => e.outcome === "blocked");
  const failed = opts.events.some((e) => e.outcome === "failure");
  const incomplete = known_gaps.some((g) => g.severity === "critical");

  const outcome: EvidenceBundleV1["summary"]["outcome"] = blocked
    ? "blocked"
    : failed
      ? "failed"
      : incomplete
        ? "incomplete"
        : "complete";

  const artifacts = opts.events.flatMap((e) => e.artifacts ?? []);

  const questionBank =
    first.flow_id === "field-service" ? FIELD_SERVICE_QUESTIONS : DEVOPS_QUESTIONS;
  const actions = new Set(opts.events.map((e) => e.action));

  const questions = questionBank.map((q) => {
    if (q.id === "artifacts") {
      const answerable = artifacts.length > 0;
      return {
        id: q.id,
        question: q.question,
        answerable,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: answerable
          ? undefined
          : "No artifact fingerprints present — recorded as known gap.",
      };
    }
    if (q.id === "before") {
      const answerable = actions.has("evidence.before_captured");
      return {
        id: q.id,
        question: q.question,
        answerable,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: answerable ? undefined : "Before evidence not recorded.",
      };
    }
    if (q.id === "after") {
      const answerable = actions.has("evidence.after_captured");
      return {
        id: q.id,
        question: q.question,
        answerable,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: answerable ? undefined : "After evidence not recorded.",
      };
    }
    if (q.id === "estimate") {
      const answerable = actions.has("estimate.approved");
      return {
        id: q.id,
        question: q.question,
        answerable,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: answerable ? undefined : "No estimate approval event.",
      };
    }
    if (q.id === "scope") {
      const changed = actions.has("scope.changed");
      const approved = actions.has("change.approved");
      return {
        id: q.id,
        question: q.question,
        answerable: !changed || approved,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: changed && !approved
          ? "Scope changed without change.approved — known gap."
          : undefined,
      };
    }
    if (q.id === "gaps") {
      return {
        id: q.id,
        question: q.question,
        answerable: true,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note:
          known_gaps.length > 0
            ? `${known_gaps.length} known gap(s) recorded`
            : "No known gaps recorded",
      };
    }
    if (q.id === "seal") {
      return {
        id: q.id,
        question: q.question,
        answerable: true,
        evidence_event_ids: opts.events.map((e) => e.event_id),
        note: "Sealed packages are immutable; re-seal creates a new package_id.",
      };
    }
    return {
      id: q.id,
      question: q.question,
      answerable: true,
      evidence_event_ids: opts.events.map((e) => e.event_id),
    };
  });

  const events_sha256 = sha256Canonical(opts.events);

  const partial: EvidenceBundleV1 = {
    schema: "QEV-EVIDENCE-BUNDLE-V1",
    package_id,
    created_at,
    tenant_id: first.tenant_id,
    flow_id: first.flow_id,
    case_id: first.case_id,
    flow_pack_version: opts.flowPackVersion ?? "0.1.0",
    events: opts.events,
    summary: {
      event_count: opts.events.length,
      outcome,
      title: opts.title ?? `${first.flow_id}:${first.case_id}`,
      questions,
    },
    artifacts,
    policy_decisions: (opts.decisions ?? []).map((d) => ({
      policy_id: d.policy_id,
      policy_version: d.policy_version,
      effect: d.effect,
      reason: d.reason,
      event_id: d.event_id,
      decided_at: d.decided_at,
    })),
    known_gaps,
    access_policy: {
      retention: "customer-controlled",
      authorized_roles: ["operator", "auditor"],
      legal_hold: false,
    },
    integrity: {
      events_sha256,
      bundle_sha256: "",
      algorithm: "SHA-256",
    },
  };

  // Hash with empty bundle_sha256, then fill.
  const forHash = {
    ...partial,
    integrity: { ...partial.integrity, bundle_sha256: "" },
  };
  partial.integrity.bundle_sha256 = sha256Canonical(forHash);

  // Sanity: re-serialize is stable via canonicalJSON consumers
  void canonicalJSON(partial);

  return partial;
}
