import type { QevEventV1 } from "./types.js";

export function assertQevEventV1(input: unknown): asserts input is QevEventV1 {
  if (!input || typeof input !== "object") {
    throw new Error("Event must be an object");
  }
  const e = input as Record<string, unknown>;
  if (e.schema !== "qev.event.v1") {
    throw new Error(`schema must be qev.event.v1, got ${String(e.schema)}`);
  }
  for (const key of [
    "event_id",
    "occurred_at",
    "observed_at",
    "tenant_id",
    "flow_id",
    "case_id",
    "action",
    "outcome",
  ] as const) {
    if (typeof e[key] !== "string" || !(e[key] as string).length) {
      throw new Error(`Missing or invalid ${key}`);
    }
  }
  if (!e.source || typeof e.source !== "object") {
    throw new Error("Missing source");
  }
  if (!e.actor || typeof e.actor !== "object") {
    throw new Error("Missing actor");
  }
  if (!e.privacy || typeof e.privacy !== "object") {
    throw new Error("Missing privacy");
  }
}

export function isQevEventV1(input: unknown): input is QevEventV1 {
  try {
    assertQevEventV1(input);
    return true;
  } catch {
    return false;
  }
}
