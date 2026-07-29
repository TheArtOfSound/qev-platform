import { createHash } from "node:crypto";

/** Stable idempotency key for ingestion (Stripe-style duplicate suppression). */
export function makeIdempotencyKey(parts: {
  tenantId: string;
  connector: string;
  providerEventId?: string;
  eventId?: string;
  rawBodySha256?: string;
}): string {
  if (parts.providerEventId) {
    return `prov:${parts.tenantId}:${parts.connector}:${parts.providerEventId}`;
  }
  if (parts.eventId) {
    return `evt:${parts.tenantId}:${parts.eventId}`;
  }
  if (parts.rawBodySha256) {
    return `raw:${parts.tenantId}:${parts.connector}:${parts.rawBodySha256}`;
  }
  const h = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 32);
  return `gen:${h}`;
}
