// Gateway console status widget.
//
// GET /v1/health and /v1/preflight are authenticated now (audit F-15):
// they used to serve the gateway's whole internal posture - preflight
// detail, connector inventory, org signing key_id, queue depths - to
// anyone who asked.
//
// Two consequences this file has to handle honestly:
//
//  1. Without a token the detailed fields are simply absent. They are
//     NOT false and NOT zero. The previous version read
//     `preflight.can_activate` straight into the badge, so a 401 would
//     have rendered as "preflight BLOCKED" - showing "we are not
//     allowed to know" as "the check failed". That is exactly the
//     unknown-as-failure confusion the trust-mark work exists to stop.
//
//  2. The token is held in memory only. It is never written to
//     localStorage or sessionStorage and never placed in a URL, so it
//     cannot outlive the tab or leak through browser history.

const statusEl = document.getElementById("status");
const badge = document.getElementById("mode-badge");

let token = null;

const authHeaders = () => (token ? { authorization: `Bearer ${token}` } : {});

async function getJson(path) {
  const res = await fetch(path, { headers: authHeaders() });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function setBadge(text, colour) {
  if (!badge) return;
  badge.textContent = text;
  badge.style.borderColor = colour;
}

async function refresh() {
  try {
    const [status, health, preflight] = await Promise.all([
      getJson("v1/status"),
      getJson("v1/health"),
      getJson("v1/preflight"),
    ]);

    const h = health.body ?? {};
    const authed = preflight.status === 200;
    const mode = h.mode ?? "unknown";

    const view = {
      authenticated: authed,
      health: {
        product: h.product,
        version: h.version,
        mode: h.mode,
        enabled: h.enabled,
        // Present in the public view: a boolean roll-up, not the detail.
        healthy: h.healthy,
        // Only present once authenticated.
        signing_key_id: h.signing?.key_id,
        queue: h.queue,
        can_activate: h.preflight?.can_activate,
      },
      status: status.body,
    };

    if (authed) {
      view.preflight_summary = preflight.body?.summary;
      view.preflight_checks = preflight.body?.checks;
    } else {
      view.detail =
        preflight.status === 401
          ? "Detailed status is authenticated. Paste the gateway's QEV_INGEST_TOKEN above to see preflight checks, connector state and the signing key id. If this gateway is still using the shipped default token, set a real one first - the detailed report refuses the default on purpose."
          : `Unexpected status ${preflight.status} from /v1/preflight.`;
    }

    statusEl.textContent = JSON.stringify(view, null, 2);

    // Three distinct states. "Unknown" never renders as "blocked".
    if (!authed) {
      const live = h.healthy === true;
      setBadge(
        `Mode: ${mode} · ${live ? "reachable" : "reachable, health unknown"} · preflight not shown (no token)`,
        "#8a8f98",
      );
    } else if (preflight.body?.can_activate) {
      setBadge(`Mode: ${mode} · preflight OK`, "#3ecf8e");
    } else {
      setBadge(`Mode: ${mode} · preflight BLOCKED`, "#f07178");
    }
  } catch (e) {
    statusEl.textContent = String(e);
    setBadge("Gateway unreachable", "#f07178");
  }
}

// Token entry, injected from here so the static HTML needs no change.
(function mountTokenField() {
  if (!statusEl || document.getElementById("gw-token")) return;
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px;";
  row.innerHTML =
    '<label for="gw-token" style="font:600 13px system-ui">Gateway token</label>' +
    '<input id="gw-token" type="password" autocomplete="off" spellcheck="false" ' +
    'placeholder="QEV_INGEST_TOKEN — kept in memory only" ' +
    'style="flex:1;min-width:240px;min-height:44px;padding:8px 10px;border-radius:6px;' +
    'border:1px solid #444;background:#111;color:#eee;font:13px ui-monospace,Menlo,monospace">' +
    '<button id="gw-apply" type="button" style="min-height:44px;padding:0 16px;border-radius:6px;' +
    'border:1px solid #444;background:#1b1b1b;color:#eee;font:600 13px system-ui;cursor:pointer">Show detail</button>';
  statusEl.parentNode.insertBefore(row, statusEl);
  const input = row.querySelector("#gw-token");
  const apply = () => {
    token = input.value.trim() || null;
    refresh();
  };
  row.querySelector("#gw-apply").addEventListener("click", apply);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") apply();
  });
})();

await refresh();
