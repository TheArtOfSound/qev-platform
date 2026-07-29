export interface FlowPack {
  id: string;
  version: string;
  title: string;
  description: string;
  mode: "shadow" | "live" | "gate";
  required_actions: string[];
  optional_actions: string[];
  privacy_defaults: {
    default_mode: "full" | "redacted" | "hash_only" | "reference_only" | "drop";
    field_modes?: Record<string, string>;
  };
  review_questions: string[];
  seal_policy: {
    allow_incomplete: boolean;
    incomplete_outcome: "incomplete" | "blocked";
  };
}
