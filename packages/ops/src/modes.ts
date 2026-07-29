/**
 * Record / shadow / gate operating modes (Seamless-Use Spec).
 * Gate is soft in P0: reports what *would* block, does not hard-stop by default.
 */
export type OperatingMode = "record" | "shadow" | "gate";

export interface ModeBehavior {
  mode: OperatingMode;
  records_events: boolean;
  controls_workflow: boolean;
  can_block_actions: boolean;
  description: string;
  human_confirm_to_enable: boolean;
}

export const MODE_BEHAVIORS: Record<OperatingMode, ModeBehavior> = {
  record: {
    mode: "record",
    records_events: true,
    controls_workflow: false,
    can_block_actions: false,
    description: "Capture only when invoked; no continuous shadow of all systems.",
    human_confirm_to_enable: false,
  },
  shadow: {
    mode: "shadow",
    records_events: true,
    controls_workflow: false,
    can_block_actions: false,
    description:
      "Automatic capture alongside normal ops; business process remains source of truth.",
    human_confirm_to_enable: false,
  },
  gate: {
    mode: "gate",
    records_events: true,
    controls_workflow: true,
    can_block_actions: true,
    description:
      "Can pause/block high-risk actions lacking evidence/approval. Requires explicit opt-in.",
    human_confirm_to_enable: true,
  },
};

export function normalizeMode(input: string | undefined): OperatingMode {
  if (input === "live") return "shadow"; // legacy wizard label
  if (input === "gate" || input === "record" || input === "shadow") return input;
  return "shadow";
}

export function gateWouldBlock(opts: {
  mode: OperatingMode;
  action: string;
  hasChangeApproval: boolean;
  completenessOk: boolean;
}): { would_block: boolean; reason?: string } {
  if (opts.mode !== "gate") {
    return { would_block: false };
  }
  if (
    (opts.action.includes("scope") || opts.action.includes("extra_work")) &&
    !opts.hasChangeApproval
  ) {
    return {
      would_block: true,
      reason: "Gate mode: added work without change.approved",
    };
  }
  if (opts.action === "package.seal" && !opts.completenessOk) {
    return {
      would_block: true,
      reason: "Gate mode: required evidence incomplete",
    };
  }
  return { would_block: false };
}
