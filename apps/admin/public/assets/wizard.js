const STEPS = [
  "Flow",
  "Storage",
  "Connectors",
  "Unlock",
  "Privacy",
  "Test",
  "Enable",
];

let step = 0;
let settings = null;

const stepsEl = document.getElementById("steps");
const panel = document.getElementById("step-panel");
const prev = document.getElementById("prev");
const next = document.getElementById("next");

function renderSteps() {
  stepsEl.innerHTML = STEPS.map(
    (s, i) => `<span class="${i === step ? "on" : ""}">${i + 1}. ${s}</span>`,
  ).join("");
}

function render() {
  renderSteps();
  prev.disabled = step === 0;
  next.textContent = step === STEPS.length - 1 ? "Finish" : "Continue";

  if (!settings) {
    panel.innerHTML = "<p>Loading settings…</p>";
    return;
  }

  if (step === 0) {
    panel.innerHTML = `
      <h2>Choose flow</h2>
      <p>Select the dedicated setup recipe. One platform underneath.</p>
      <label><input type="radio" name="flow" value="field-service" checked />
        <strong>Field Service Job Evidence</strong> — jobs, estimates, photos, invoices</label>
      <p class="hint">AI, legal, and devops packs stay available later; this pilot freezes Field Service.</p>
    `;
  } else if (step === 1) {
    panel.innerHTML = `
      <h2>Where packages are stored</h2>
      <p>Packages write to the customer-controlled gateway folder. Plaintext does not need to reach Qira.</p>
      <label>Storage description
        <input id="storage_label" value="${escapeAttr(settings.storage_dir_label)}" />
      </label>
      <p class="hint">Path is configured on the gateway host (data/packages). Cloud/WORM later.</p>
    `;
  } else if (step === 2) {
    panel.innerHTML = `
      <h2>Connectors</h2>
      <p>Three universal pieces — not AH Crap-specific code.</p>
      <label><input type="checkbox" id="c_portal" ${settings.connectors.job_portal.enabled ? "checked" : ""}/> QEV Job Portal</label>
      <label><input type="checkbox" id="c_photo" ${settings.connectors.photo_file.enabled ? "checked" : ""}/> Photo &amp; File</label>
      <label><input type="checkbox" id="c_hook" ${settings.connectors.generic_webhook.enabled ? "checked" : ""}/> Generic Email/Webhook</label>
      <p class="hint">Webhook secret is set via QEV_WEBHOOK_SECRET on the host — never pasted into browser storage.</p>
    `;
  } else if (step === 3) {
    panel.innerHTML = `
      <h2>Who can open packages</h2>
      <label><input type="checkbox" id="pass_unlock" ${settings.unlock.passphrase_enabled ? "checked" : ""}/> Package passphrase (pilot)</label>
      <p class="hint">${escapeHtml(settings.unlock.note)}</p>
      <label>Recipient roles (comma-separated)
        <input id="recipients" value="${escapeAttr(settings.recipients.join(", "))}" />
      </label>
    `;
  } else if (step === 4) {
    panel.innerHTML = `
      <h2>Privacy mapping</h2>
      <p>Per-field mode: full · redacted · hash_only · drop</p>
      <label>Default mode
        <select id="priv_default">
          ${["full", "redacted", "hash_only", "reference_only", "drop"]
            .map(
              (m) =>
                `<option ${settings.privacy.default_mode === m ? "selected" : ""}>${m}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>customer_phone
        <select id="priv_phone">${privOpts(settings.privacy.field_modes.customer_phone)}</select>
      </label>
      <label>customer_email
        <select id="priv_email">${privOpts(settings.privacy.field_modes.customer_email)}</select>
      </label>
      <label>internal_notes
        <select id="priv_notes">${privOpts(settings.privacy.field_modes.internal_notes || "drop")}</select>
      </label>
    `;
  } else if (step === 5) {
    panel.innerHTML = `
      <h2>Run a test job</h2>
      <p>Creates a synthetic job, records required steps, uploads tiny before/after files, seals a package.</p>
      <button type="button" class="primary" id="run-test">Run synthetic test job</button>
      <pre id="test-out">Waiting…</pre>
    `;
    document.getElementById("run-test").onclick = runTest;
  } else {
    panel.innerHTML = `
      <h2>Enable flow</h2>
      <div id="preflight-box"><p class="hint">Running preflight…</p></div>
      <label>Mode
        <select id="mode">
          <option value="shadow" ${settings.mode === "shadow" || settings.mode === "live" ? "selected" : ""}>Shadow (auto-capture, no control — recommended)</option>
          <option value="record" ${settings.mode === "record" ? "selected" : ""}>Record (manual capture only)</option>
          <option value="gate" ${settings.mode === "gate" ? "selected" : ""}>Gate (can block — requires confirmation)</option>
        </select>
      </label>
      <label id="gate-confirm-wrap" style="display:none">
        <input type="checkbox" id="gate_confirmed" /> I understand gate mode can block business actions (human confirmation)
      </label>
      <label><input type="checkbox" id="enabled" ${settings.enabled ? "checked" : ""}/> Enable Field Service flow</label>
      <p class="hint">Activation is blocked if critical preflight checks fail. Gate mode always requires explicit confirmation.</p>
    `;
    loadPreflight();
    document.getElementById("mode")?.addEventListener("change", () => {
      const m = document.getElementById("mode")?.value;
      const w = document.getElementById("gate-confirm-wrap");
      if (w) w.style.display = m === "gate" ? "block" : "none";
    });
  }
}

async function loadPreflight() {
  const box = document.getElementById("preflight-box");
  if (!box) return;
  try {
    const pf = await (await fetch("v1/preflight")).json();
    box.innerHTML = `
      <p><strong>Preflight:</strong> ${pf.summary}</p>
      <ul style="font-size:0.85rem;color:#8b9bb0">
        ${(pf.checks || [])
          .map(
            (c) =>
              `<li>${c.ok ? "✓" : "✗"} ${c.label} — ${c.detail}</li>`,
          )
          .join("")}
      </ul>
    `;
    window.__qev_preflight_ok = pf.can_activate;
  } catch (e) {
    box.textContent = String(e);
  }
}

function privOpts(cur) {
  return ["full", "redacted", "hash_only", "reference_only", "drop"]
    .map((m) => `<option ${cur === m ? "selected" : ""}>${m}</option>`)
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

function collect() {
  if (!settings) return;
  if (step === 1) {
    const el = document.getElementById("storage_label");
    if (el) settings.storage_dir_label = el.value;
  }
  if (step === 2) {
    settings.connectors.job_portal.enabled =
      document.getElementById("c_portal")?.checked ?? true;
    settings.connectors.photo_file.enabled =
      document.getElementById("c_photo")?.checked ?? true;
    settings.connectors.generic_webhook.enabled =
      document.getElementById("c_hook")?.checked ?? true;
  }
  if (step === 3) {
    settings.unlock.passphrase_enabled =
      document.getElementById("pass_unlock")?.checked ?? true;
    const r = document.getElementById("recipients")?.value ?? "";
    settings.recipients = r.split(",").map((x) => x.trim()).filter(Boolean);
  }
  if (step === 4) {
    settings.privacy.default_mode =
      document.getElementById("priv_default")?.value ?? "full";
    settings.privacy.field_modes.customer_phone =
      document.getElementById("priv_phone")?.value ?? "redacted";
    settings.privacy.field_modes.customer_email =
      document.getElementById("priv_email")?.value ?? "redacted";
    settings.privacy.field_modes.internal_notes =
      document.getElementById("priv_notes")?.value ?? "drop";
  }
  if (step === 6) {
    settings.mode = document.getElementById("mode")?.value ?? "shadow";
    settings.enabled = document.getElementById("enabled")?.checked ?? false;
    settings.gate_confirmed =
      document.getElementById("gate_confirmed")?.checked ?? false;
    settings.setup_completed = true;
  }
}

async function save() {
  collect();
  const res = await fetch("v1/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });
  const body = await res.json();
  if (!res.ok) {
    alert(
      body.error
        ? `${body.error}\n${body.preflight?.summary || ""}`
        : JSON.stringify(body),
    );
    throw new Error(body.error || "settings save failed");
  }
  settings = body;
}

async function runTest() {
  const out = document.getElementById("test-out");
  out.textContent = "Running…";
  const caseId = `JOB-TEST-${Date.now()}`;
  const token = "dev-ingest-token-change-me";
  const pass = "change-me-for-local-dev-only";
  try {
    for (const action of [
      "job.created",
      "estimate.approved",
      "work.completed",
    ]) {
      await fetch("v1/portal/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          action,
          actor: { id: "wizard-test@local" },
        }),
      });
    }
    for (const kind of ["before", "after"]) {
      await fetch("v1/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          kind,
          filename: `${kind}.txt`,
          content_base64: btoa(`synthetic ${kind} for ${caseId}`),
        }),
      });
    }
    const seal = await fetch("v1/flows/field-service/complete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ case_id: caseId, passphrase: pass }),
    });
    const sealed = await seal.json();
    const ver = await fetch(`v1/packages/${sealed.package_id}/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ passphrase: pass }),
    });
    const report = await ver.json();
    out.textContent = JSON.stringify({ caseId, sealed, report }, null, 2);
  } catch (e) {
    out.textContent = String(e);
  }
}

prev.onclick = async () => {
  collect();
  step = Math.max(0, step - 1);
  render();
};

next.onclick = async () => {
  await save();
  if (step >= STEPS.length - 1) {
    panel.innerHTML = `<h2>Done</h2><p>Flow ${settings.enabled ? "enabled" : "configured"} in <strong>${settings.mode}</strong> mode.</p>
      <p><a href="portal">Open job portal →</a> · <a href="review">Review packages →</a></p>`;
    next.disabled = true;
    return;
  }
  step += 1;
  render();
};

settings = await (await fetch("v1/settings")).json();
render();
