/**
 * Automatic case correlation with confidence (Seamless-Use Spec §7).
 */
export type MatchConfidence =
  | "exact"
  | "high"
  | "uncertain"
  | "unmatched"
  | "conflicting";

export interface MatchCandidate {
  case_id: string;
  confidence: MatchConfidence;
  reason: string;
  score: number;
}

export interface MatchInput {
  explicit_case_id?: string;
  provider_object_id?: string;
  invoice_ref?: string;
  email_subject?: string;
  folder_path?: string;
  artifact_name?: string;
  /** Existing case ids known to gateway */
  known_case_ids: string[];
  /** Optional map provider id → case id */
  provider_index?: Record<string, string>;
}

export interface MatchResult {
  confidence: MatchConfidence;
  case_id?: string;
  candidates: MatchCandidate[];
  needs_manual_review: boolean;
  detail: string;
}

export function matchCase(input: MatchInput): MatchResult {
  const candidates: MatchCandidate[] = [];

  if (input.explicit_case_id) {
    candidates.push({
      case_id: input.explicit_case_id,
      confidence: "exact",
      reason: "Explicit QEV case / job ID",
      score: 100,
    });
  }

  if (input.provider_object_id && input.provider_index?.[input.provider_object_id]) {
    candidates.push({
      case_id: input.provider_index[input.provider_object_id]!,
      confidence: "exact",
      reason: "Provider object ID index",
      score: 95,
    });
  }

  // Subject tag: [JOB-123] or JOB-123
  if (input.email_subject) {
    const m =
      /\[([A-Z]+-\d+[A-Z0-9-]*)\]/i.exec(input.email_subject) ||
      /\b(JOB-[A-Z0-9-]+)\b/i.exec(input.email_subject);
    if (m?.[1]) {
      const id = m[1]!.toUpperCase().startsWith("JOB")
        ? m[1]!
        : m[1]!;
      candidates.push({
        case_id: id,
        confidence: "high",
        reason: "Email subject job tag",
        score: 80,
      });
    }
  }

  if (input.folder_path) {
    const m = /(JOB-[A-Z0-9-]+)/i.exec(input.folder_path);
    if (m?.[1]) {
      candidates.push({
        case_id: m[1]!,
        confidence: "high",
        reason: "Folder path segment",
        score: 75,
      });
    }
  }

  if (input.invoice_ref) {
    const m = /(JOB-[A-Z0-9-]+)/i.exec(input.invoice_ref);
    if (m?.[1]) {
      candidates.push({
        case_id: m[1]!,
        confidence: "high",
        reason: "Invoice reference",
        score: 70,
      });
    }
  }

  if (input.artifact_name) {
    const m = /(JOB-[A-Z0-9-]+)/i.exec(input.artifact_name);
    if (m?.[1]) {
      candidates.push({
        case_id: m[1]!,
        confidence: "uncertain",
        reason: "Artifact filename hint",
        score: 40,
      });
    }
  }

  // Dedupe by case_id keeping highest score
  const byId = new Map<string, MatchCandidate>();
  for (const c of candidates) {
    const prev = byId.get(c.case_id);
    if (!prev || c.score > prev.score) byId.set(c.case_id, c);
  }
  const unique = [...byId.values()].sort((a, b) => b.score - a.score);

  if (unique.length === 0) {
    return {
      confidence: "unmatched",
      candidates: [],
      needs_manual_review: true,
      detail: "No case match — route to manual review queue",
    };
  }

  if (unique.length > 1 && unique[0]!.score === unique[1]!.score) {
    return {
      confidence: "conflicting",
      candidates: unique,
      needs_manual_review: true,
      detail: "Multiple cases matched with equal confidence",
    };
  }

  const best = unique[0]!;
  // Prefer known cases
  if (
    input.known_case_ids.length &&
    !input.known_case_ids.includes(best.case_id) &&
    best.confidence !== "exact"
  ) {
    return {
      confidence: "uncertain",
      case_id: best.case_id,
      candidates: unique,
      needs_manual_review: true,
      detail: `Best match ${best.case_id} is not yet an open case`,
    };
  }

  return {
    confidence: best.confidence,
    case_id: best.case_id,
    candidates: unique,
    needs_manual_review: best.confidence === "uncertain",
    detail: best.reason,
  };
}
