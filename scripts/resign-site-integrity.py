#!/usr/bin/env python3
"""Re-sign production secure.imagineqira.com content tree.

Usage (from a checkout that has the private key):
  python3 scripts/resign-site-integrity.py \
    --site-root /path/to/webroot \
    --key /path/to/site-signer.ed25519.key

Produces site-integrity.json in the site root and patches verify.html
so the integrity record is server-rendered (F-007 fix).
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
    # package binaries can be large; still should be hashed if present under downloads
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


def sign_manifest(priv: Ed25519PrivateKey, body: dict) -> str:
    # Canonical JSON without signature field
    payload = json.dumps(body, indent=2, sort_keys=True).encode("utf-8")
    msg = SIGNATURE_DOMAIN + b"\n" + payload
    sig = priv.sign(msg)
    return base64.b64encode(sig).decode("ascii")


def patch_verify_html(root: Path, record: dict) -> None:
    path = root / "verify.html"
    if not path.exists():
        print("warn: verify.html missing")
        return
    html = path.read_text(encoding="utf-8")
    summary = {
        "schema": record.get("schema"),
        "site": record.get("site"),
        "signed_at": record.get("signed_at"),
        "file_count": record.get("file_count"),
        "public_key": record.get("public_key") or record.get("signer_public_key"),
        "signature_scheme": record.get("signature", {}).get("scheme")
        if isinstance(record.get("signature"), dict)
        else record.get("signature_scheme"),
        "note": "Server-rendered summary. Full record at /site-integrity.json",
    }
    summary_json = json.dumps(summary, indent=2)
    # Replace loading/error default state with server-rendered pre content
    new_block = f'''      <div id="integrity-loading" style="display:none">Loading integrity record...</div>
      <pre id="integrity-record" style="display:block; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px; font-size: 0.82rem; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere; max-height: 500px;">{summary_json}</pre>
      <div id="integrity-error" style="display:none; color: var(--amber-text);">Could not refresh the integrity record. Server-rendered summary is shown above; download /site-integrity.json for the full signed manifest.</div>'''
    pattern = re.compile(
        r'<div id="integrity-loading">.*?</div>\s*'
        r'<pre id="integrity-record"[^>]*>.*?</pre>\s*'
        r'<div id="integrity-error"[^>]*>.*?</div>',
        re.DOTALL,
    )
    if not pattern.search(html):
        print("warn: verify.html block not matched; leaving page unchanged")
        return
    html = pattern.sub(new_block, html, count=1)
    # Improve fetch script to keep server-rendered content on failure
    html = html.replace(
        "document.getElementById('integrity-error').style.display = 'block';",
        "document.getElementById('integrity-error').style.display = 'block';\n"
        "    // Keep server-rendered summary visible (F-007)",
    )
    path.write_text(html, encoding="utf-8")
    print("patched verify.html")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-root", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--site-name", default="secure.imagineqira.com")
    args = ap.parse_args()
    root = Path(args.site_root).resolve()
    priv = load_key(Path(args.key))
    pub = public_hex(priv)

    files = collect_files(root)
    file_hashes = {rel: sha256_file(root / rel) for rel in files}
    body = {
        "schema": "BRY-NFET-SX-SITE-INTEGRITY-V2",
        "site": args.site_name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(file_hashes),
        "files": file_hashes,
        "public_key": pub,
        "signature": {
            "scheme": "ed25519",
            "domain": "BRY-NFET-SX|SITE-INTEGRITY|V2",
            "encoding": "base64",
        },
    }
    # sign without the value field
    sig_b64 = sign_manifest(priv, body)
    body["signature"]["value"] = sig_b64

    out = root / "site-integrity.json"
    out.write_text(json.dumps(body, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {out} files={len(file_hashes)}")

    # Patch verify, then re-hash verify.html and re-sign
    patch_verify_html(root, body)
    if "verify.html" in file_hashes:
        file_hashes["verify.html"] = sha256_file(root / "verify.html")
        body["files"] = file_hashes
        body["file_count"] = len(file_hashes)
        body["signed_at"] = datetime.now(timezone.utc).isoformat()
        # clear previous sig value for re-sign
        body["signature"] = {
            "scheme": "ed25519",
            "domain": "BRY-NFET-SX|SITE-INTEGRITY|V2",
            "encoding": "base64",
        }
        body["signature"]["value"] = sign_manifest(priv, body)
        out.write_text(json.dumps(body, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print("re-signed after verify.html patch")

    print("public_key", pub)


if __name__ == "__main__":
    main()
