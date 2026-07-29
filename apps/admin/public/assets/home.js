const statusEl = document.getElementById("status");
const badge = document.getElementById("mode-badge");

try {
  const [status, health, preflight] = await Promise.all([
    fetch("v1/status").then((r) => r.json()),
    fetch("v1/health").then((r) => r.json()),
    fetch("v1/preflight").then((r) => r.json()),
  ]);
  statusEl.textContent = JSON.stringify(
    {
      health: {
        mode: health.mode,
        enabled: health.enabled,
        signing_key_id: health.signing?.key_id,
        queue: health.queue,
        can_activate: health.preflight?.can_activate,
      },
      preflight_summary: preflight.summary,
      preflight_checks: preflight.checks,
      status,
    },
    null,
    2,
  );
  const mode = health.mode ?? "shadow";
  badge.textContent = preflight.can_activate
    ? `Mode: ${mode} · preflight OK`
    : `Mode: ${mode} · preflight BLOCKED`;
  badge.style.borderColor = preflight.can_activate ? "#3ecf8e" : "#f07178";
} catch (e) {
  statusEl.textContent = String(e);
}

