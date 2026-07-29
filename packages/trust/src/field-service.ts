import type { FlowPack } from "./flow-types.js";

/**
 * Field Service Job Evidence — first commercial flow pack for contractors.
 * Used by AH Crap as deployment #1 after Stage 0–1 pass — not invented mid-pilot.
 */
export const FIELD_SERVICE_PACK: FlowPack = {
  id: "field-service",
  version: "0.1.0",
  title: "Field Service Job Evidence",
  description:
    "Capture job, estimate approval, before/after evidence, work completion, and optional billing for small field-service businesses.",
  mode: "shadow",
  required_actions: [
    "job.created",
    "estimate.approved",
    "evidence.before_captured",
    "work.completed",
    "evidence.after_captured",
  ],
  optional_actions: [
    "estimate.prepared",
    "work.started",
    "scope.changed",
    "change.approved",
    "invoice.issued",
    "payment.recorded",
    "customer.completion_confirmed",
  ],
  privacy_defaults: {
    default_mode: "full",
    field_modes: {
      customer_phone: "redacted",
      customer_email: "redacted",
      card_last4: "hash_only",
      internal_notes: "drop",
    },
  },
  review_questions: [
    "What job is this?",
    "Who approved the estimate?",
    "Were before photos captured?",
    "Was scope changed, and was the change approved?",
    "Were after photos captured?",
    "What evidence is missing?",
    "Did the package change after sealing?",
  ],
  seal_policy: {
    allow_incomplete: true,
    incomplete_outcome: "incomplete",
  },
};
