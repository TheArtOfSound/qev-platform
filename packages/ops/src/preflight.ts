/**
 * Preflight checks before activation (Seamless-Use Spec §3.4).
 * Critical failures block enablement.
 */
export type PreflightSeverity = "critical" | "warning" | "info";

export interface PreflightCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: PreflightSeverity;
  detail: string;
}

export interface PreflightReport {
  checked_at: string;
  checks: PreflightCheck[];
  critical_failures: number;
  warnings: number;
  can_activate: boolean;
  summary: string;
}

export interface PreflightInput {
  gateway_reachable: boolean;
  storage_writable: boolean;
  backup_writable: boolean;
  signing_key_present: boolean;
  encryption_passphrase_configured: boolean;
  webhook_secret_configured: boolean;
  queue_healthy: boolean;
  case_log_chain_ok: boolean;
  package_roundtrip_ok?: boolean;
  clock_skew_seconds?: number;
}

export function runPreflight(input: PreflightInput): PreflightReport {
  const checks: PreflightCheck[] = [
    {
      id: "gateway",
      label: "Gateway reachable",
      ok: input.gateway_reachable,
      severity: "critical",
      detail: input.gateway_reachable ? "Process responding" : "Not reachable",
    },
    {
      id: "storage",
      label: "Storage writable",
      ok: input.storage_writable,
      severity: "critical",
      detail: input.storage_writable
        ? "Package directory writable"
        : "Cannot write packages",
    },
    {
      id: "backup",
      label: "Backup location writable",
      ok: input.backup_writable,
      severity: "warning",
      detail: input.backup_writable
        ? "Backup folder writable"
        : "Backup folder not writable",
    },
    {
      id: "signing_key",
      label: "Organization signing key",
      ok: input.signing_key_present,
      severity: "critical",
      detail: input.signing_key_present
        ? "Ed25519 signing key available"
        : "Signing key missing",
    },
    {
      id: "passphrase",
      label: "Package unlock configured",
      ok: input.encryption_passphrase_configured,
      severity: "critical",
      detail: input.encryption_passphrase_configured
        ? "Passphrase present in environment (pilot)"
        : "No package passphrase configured",
    },
    {
      id: "webhook_secret",
      label: "Webhook secret configured",
      ok: input.webhook_secret_configured,
      severity: "warning",
      detail: input.webhook_secret_configured
        ? "Webhook HMAC secret set"
        : "Using insecure default secret",
    },
    {
      id: "queue",
      label: "Durable queue healthy",
      ok: input.queue_healthy,
      severity: "critical",
      detail: input.queue_healthy ? "Queue directories OK" : "Queue not healthy",
    },
    {
      id: "case_log",
      label: "Case log chain",
      ok: input.case_log_chain_ok,
      severity: "warning",
      detail: input.case_log_chain_ok
        ? "Append-only chain verifies"
        : "Case log chain broken",
    },
  ];

  if (input.package_roundtrip_ok !== undefined) {
    checks.push({
      id: "roundtrip",
      label: "Package seal/open self-test",
      ok: input.package_roundtrip_ok,
      severity: "critical",
      detail: input.package_roundtrip_ok
        ? "Encrypt/decrypt self-test passed"
        : "Encrypt/decrypt self-test failed",
    });
  }

  if (input.clock_skew_seconds !== undefined) {
    const ok = Math.abs(input.clock_skew_seconds) < 300;
    checks.push({
      id: "clock",
      label: "Clock skew",
      ok,
      severity: ok ? "info" : "warning",
      detail: `Skew ${input.clock_skew_seconds}s (warn if >300s)`,
    });
  }

  const critical_failures = checks.filter(
    (c) => !c.ok && c.severity === "critical",
  ).length;
  const warnings = checks.filter((c) => !c.ok && c.severity === "warning").length;

  return {
    checked_at: new Date().toISOString(),
    checks,
    critical_failures,
    warnings,
    can_activate: critical_failures === 0,
    summary:
      critical_failures === 0
        ? warnings
          ? `Ready with ${warnings} warning(s)`
          : "All critical preflight checks passed"
        : `Blocked: ${critical_failures} critical failure(s)`,
  };
}
