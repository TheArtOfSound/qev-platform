const out = document.getElementById("out");

function log(obj) {
  out.textContent =
    typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

document.getElementById("send-event").onclick = async () => {
  const case_id = document.getElementById("case_id").value.trim();
  if (!case_id) return log("Job ID required");
  const res = await fetch("v1/portal/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      case_id,
      action: document.getElementById("action").value,
      actor: {
        id: document.getElementById("actor").value,
      },
      payload: { notes: document.getElementById("notes").value || undefined },
    }),
  });
  log(await res.json());
};

document.getElementById("upload").onclick = async () => {
  const case_id = document.getElementById("case_id").value.trim();
  const file = document.getElementById("file").files?.[0];
  if (!case_id || !file) return log("Job ID and file required");
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const content_base64 = btoa(binary);
  const res = await fetch("v1/photos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      case_id,
      kind: document.getElementById("photo-kind").value,
      filename: file.name,
      content_base64,
      actor: { id: document.getElementById("actor").value },
    }),
  });
  log(await res.json());
};

document.getElementById("seal").onclick = async () => {
  const case_id = document.getElementById("case_id").value.trim();
  if (!case_id) return log("Job ID required");
  const res = await fetch("v1/flows/field-service/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer dev-ingest-token-change-me",
    },
    body: JSON.stringify({
      case_id,
      passphrase: document.getElementById("pass").value,
    }),
  });
  log(await res.json());
};
