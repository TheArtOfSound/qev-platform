#!/usr/bin/env python3
"""Re-sign production secure.imagineqira.com content tree.

Produces site-integrity.json in the format expected by site-verify.js:
  - signer.public_key_hex (must match PINNED_SIGNER_PUBKEY_HEX in site-verify.js)
  - signature.algorithm = "ed25519"
  - signature.signature_hex (hex-encoded ed25519 sig)
  - Signed bytes = domain || canonical_json(manifest without signature)
  - canonical JSON = json.dumps(..., sort_keys=True, separators=(',', ':'),
                                 ensure_ascii=False)

Usage (from a checkout that has the private key):
  python3 scripts/resign-site-integrity.py \
    --site-root /path/to/webroot \
    --key /path/to/site-signer.ed25519.key

Also patches verify.html so the integrity summary is server-rendered (F-007).
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SIGNATURE_DOMAIN = b"BRY-NFET-SX|SITE-INTEGRITY|V2"
SIGNATURE_SCHEME = "ed25519"
EXCLUDE_NAMES = {
    "site-integrity.json",
    ".DS_Store",
    ".indexnow-key",
}
EXCLUDE_SUFFIXES = (".bak", ".bak.preeco", ".map")
EXCLUDE_PREFIXES = ("._",)


def should_include(rel: str) -> bool:
    name = Path(rel).name
    if name in EXCLUDE_NAMES:
        return False
    if name.startswith(EXCLUDE_PREFIXES):
        return False
    if any(name.endswith(s) for s in EXCLUDE_SUFFIXES):
        return False
    # third-party verification tokens
    if re.fullmatch(r"[a-f0-9]{32}\.txt", name):
        return False
    if name.startswith("google") and name.endswith(".html"):
        return False
    return True


def collect_files(root: Path) -> list[str]:
    files: list[str] = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        rel = str(p.relative_to(root)).replace("\\", "/")
        if should_include(rel):
            files.append(rel)
    return files


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_key(path: Path) -> Ed25519PrivateKey:
    pem = path.read_bytes()
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise SystemExit(f"not ed25519 key: {path}")
    return key


def public_hex(priv: Ed25519PrivateKey) -> str:
    raw = priv.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return raw.hex()


def canonical_manifest_bytes(manifest: dict) -> bytes:
    """Minified sorted JSON — must match site-verify.js canonicalJsonBytes."""
    return json.dumps(
        manifest,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def sign_manifest(priv: Ed25519PrivateKey, manifest: dict) -> str:
    """Return hex-encoded ed25519 signature over domain || canonical JSON.

    Manifest must NOT include a `signature` field (site-verify.js deletes it
    before verifying).
    """
    if "signature" in manifest:
        raise ValueError("manifest must not include signature when signing")
    signed_bytes = SIGNATURE_DOMAIN + canonical_manifest_bytes(manifest)
    sig = priv.sign(signed_bytes)
    # self-check
    priv.public_key().verify(sig, signed_bytes)
    return sig.hex()


def patch_verify_html(root: Path, record: dict) -> None:
    path = root / "verify.html"
    if not path.exists():
        print("warn: verify.html missing")
        return
    html = path.read_text(encoding="utf-8")
    signer = record.get("signer") or {}
    sig = record.get("signature") or {}
    summary = {
        "schema": record.get("schema"),
        "site": record.get("site"),
        "signed_at": record.get("signed_at"),
        "file_count": record.get("file_count"),
        "public_key": signer.get("public_key_hex") or record.get("public_key"),
        "signature_scheme": sig.get("algorithm") or sig.get("scheme"),
        "note": "Server-rendered summary. Full record at /site-integrity.json",
    }
    summary_json = json.dumps(summary, indent=2)
    new_block = f'''      <div id="integrity-loading" style="display:none">Loading integrity record...</div>
      <pre id="integrity-record" style="display:block; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px; font-size: 0.82rem; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere; max-height: 500px;">{summary_json}</pre>
      <div id="integrity-error" style="display:none; color: var(--amber-text);">Could not refresh the integrity record. Server-rendered summary is shown above; download /site-integrity.json for the full signed manifest.</div>'''
    pattern = re.compile(
        r'<div id="integrity-loading"[^>]*>.*?</div>\s*'
        r'<pre id="integrity-record"[^>]*>.*?</pre>\s*'
        r'<div id="integrity-error"[^>]*>.*?</div>',
        re.DOTALL,
    )
    if not pattern.search(html):
        # Do NOT warn-and-continue. Silently leaving the page unpatched
        # ships a /verify with the loading state visible and the
        # server-rendered summary hidden, so a JS-disabled reader sees
        # "Loading integrity record..." forever. That is the exact F-007
        # regression this function exists to prevent, and a warning in a
        # deploy log is not enough to catch it.
        raise SystemExit(
            "resign: verify.html integrity block did not match.\n"
            "  The markup changed and this patch would be skipped, shipping\n"
            "  an unpatched /verify. Fix the markup or this pattern, then\n"
            "  re-run. Expected, in order and adjacent:\n"
            "    <div id=\"integrity-loading\" ...>...</div>\n"
            "    <pre id=\"integrity-record\" ...>...</pre>\n"
            "    <div id=\"integrity-error\" ...>...</div>"
        )
    html = pattern.sub(new_block, html, count=1)
    if "Keep server-rendered summary visible (F-007)" not in html:
        html = html.replace(
            "document.getElementById('integrity-error').style.display = 'block';",
            "document.getElementById('integrity-error').style.display = 'block';\n"
            "    // Keep server-rendered summary visible (F-007)",
        )
    path.write_text(html, encoding="utf-8")
    print("patched verify.html")


def build_record(
    priv: Ed25519PrivateKey,
    site_name: str,
    file_hashes: dict[str, str],
) -> dict:
    pub = public_hex(priv)
    manifest = {
        "schema": "BRY-NFET-SX-SITE-INTEGRITY-V2",
        "site": site_name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(file_hashes),
        "files": file_hashes,
        "signer": {
            "scheme": SIGNATURE_SCHEME,
            "public_key_hex": pub,
            "public_key_url": f"https://{site_name}/site-signer.ed25519.pub",
            "domain": SIGNATURE_DOMAIN.decode("ascii"),
        },
    }
    sig_hex = sign_manifest(priv, manifest)
    return {
        **manifest,
        "signature": {
            "algorithm": SIGNATURE_SCHEME,
            "domain": SIGNATURE_DOMAIN.decode("ascii"),
            "public_key_hex": pub,
            "signature_hex": sig_hex,
            "canonical_json_note": (
                "The signed bytes are: "
                f"{SIGNATURE_DOMAIN.decode('ascii')}"
                "|| json.dumps(manifest_without_signature, sort_keys=True, "
                "separators=(',', ':'), ensure_ascii=False).encode('utf-8'). "
                "The 'manifest_without_signature' object is this record "
                "with the 'signature' field removed. JS verifiers: "
                "recursively sort object keys, then JSON.stringify(obj) "
                "with no indent argument — this produces the same bytes."
            ),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-root", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--site-name", default="secure.imagineqira.com")
    args = ap.parse_args()
    root = Path(args.site_root).resolve()
    priv = load_key(Path(args.key))
    pub = public_hex(priv)
    print(f"public_key {pub}")

    files = collect_files(root)
    file_hashes = {rel: sha256_file(root / rel) for rel in files}
    record = build_record(priv, args.site_name, file_hashes)

    out = root / "site-integrity.json"
    out.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} files={len(file_hashes)}")

    # Patch verify, then re-hash verify.html and re-sign so hashes stay true
    patch_verify_html(root, record)
    if (root / "verify.html").exists():
        file_hashes["verify.html"] = sha256_file(root / "verify.html")
        record = build_record(priv, args.site_name, file_hashes)
        out.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print("re-signed after verify.html patch")

    print(f"files signed: {record['file_count']}")
    print(f"signed_at:    {record['signed_at']}")
    print(f"sig prefix:   {record['signature']['signature_hex'][:32]}...")


if __name__ == "__main__":
    main()
