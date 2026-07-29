const pkgSel = document.getElementById("pkg");
const verdicts = document.getElementById("verdicts");
const timeline = document.getElementById("timeline");
const rely = document.getElementById("rely");

async function refresh() {
  const res = await fetch("v1/packages");
  const data = await res.json();
  pkgSel.innerHTML = (data.packages || [])
    .map(
      (p) =>
        `<option value="${p.package_id}">${p.case_id} · ${p.package_id.slice(0, 18)}… · ${p.public_meta?.outcome}</option>`,
    )
    .join("");
  if (!data.packages?.length) {
    pkgSel.innerHTML = `<option value="">No packages yet</option>`;
  }
}

function levelClass(level) {
  return `level ${level}`;
}

document.getElementById("refresh").onclick = refresh;

document.getElementById("verify").onclick = async () => {
  const id = pkgSel.value;
  if (!id) return;
  verdicts.innerHTML = "Verifying…";
  const res = await fetch(`v1/packages/${id}/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer dev-ingest-token-change-me",
    },
    body: JSON.stringify({
      passphrase: document.getElementById("pass").value,
    }),
  });
  const report = await res.json();
  if (!report.multi_verdict) {
    verdicts.innerHTML = `<pre>${JSON.stringify(report, null, 2)}</pre>`;
    return;
  }
  const mv = report.multi_verdict;
  verdicts.innerHTML = mv.lines
    .map(
      (l) => `
      <div class="line">
        <div>
          <strong>${l.label}</strong><br/>
          <span style="color:#8b9bb0;font-size:0.85rem">${l.detail}</span>
        </div>
        <span class="${levelClass(l.level)}">${l.level.replaceAll("_", " ")}</span>
      </div>`,
    )
    .join("");

  if (mv.required_evidence?.missing?.length) {
    verdicts.innerHTML += `<p class="hint">Missing required: ${mv.required_evidence.missing.join(", ")}</p>`;
  }
  if (mv.known_gaps?.length) {
    verdicts.innerHTML += `<p class="hint">Known gaps: ${mv.known_gaps.map((g) => g.message).join("; ")}</p>`;
  }

  timeline.innerHTML = (mv.timeline || [])
    .map(
      (t) => `
      <div class="timeline-item">
        <strong>${t.action}</strong> · ${t.actor}<br/>
        <small>${t.at} · ${t.source} · ${t.event_id}</small>
      </div>`,
    )
    .join("");

  rely.innerHTML = `
    <p><strong>Safe to rely for</strong></p>
    <ul>${(mv.overall_safe_to_rely_for || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    <p><strong>Not safe to rely for</strong></p>
    <ul>${(mv.overall_not_safe_to_rely_for || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    <p class="hint">Content truth: ${mv.content_truth}</p>
  `;
};

await refresh();
