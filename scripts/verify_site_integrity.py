#!/usr/bin/env python3
"""Independently verify the signed site-integrity manifest for secure.imagineqira.com.

This is the verifier referenced by https://secure.imagineqira.com/verify. It is
read-only: it issues HTTP GETs and reads local files. It never writes to the
network, never touches the site, and never needs the private key.

It performs the two checks the /verify page documents:

  Step 1  ed25519 signature over the manifest.
  Step 2  SHA-256 of every file listed in the manifest.

CANONICALIZATION (the part that is easy to get wrong)
-----------------------------------------------------
The signed bytes are EXACTLY:

    b"BRY-NFET-SX|SITE-INTEGRITY|V2"
    + json.dumps(manifest_without_signature,
                 sort_keys=True,
                 separators=(",", ":"),
                 ensure_ascii=False).encode("utf-8")

where ``manifest_without_signature`` is the parsed /site-integrity.json with the
top-level "signature" key removed (nothing else removed, nothing reordered by
hand -- sort_keys does the ordering).

Three things about that, because published recipes have gotten each of them
wrong:

  * The domain separator has NO trailing "||" and no trailing newline. It is
    the 29 bytes of "BRY-NFET-SX|SITE-INTEGRITY|V2" and then the JSON begins
    immediately. The ``signature.canonical_json_note`` field inside the record
    itself currently describes a trailing "||"; that description does not
    verify. This script warns when it sees that stale note.
  * The JSON is COMPACT (separators=(",", ":")), not indent=2. An indent=2
    recipe does not verify.
  * ensure_ascii=False, so non-ASCII characters are emitted as UTF-8 rather
    than \\uXXXX escapes. The current record is pure ASCII either way, but the
    signer's canonicalization is the UTF-8 one, so we match it.

A JS verifier reproduces the same bytes by recursively sorting object keys and
then calling JSON.stringify with no indent argument. See landing/site-verify.js.

Note on the scheme itself: because the canonical form is produced by
re-serializing parsed JSON, this construction canonicalizes the *decoded* value,
not the exact bytes served. That is fine for this manifest (all values are
strings and integers) but it is a property of the scheme worth knowing.

TRUST IN THE KEY
----------------
The signed bytes are reconstructed using the domain separator hard-coded above,
not one read out of the manifest, so a manifest cannot talk this script into
verifying against different parameters.

The signing key is cross-checked three ways -- manifest ``signer.public_key_hex``,
manifest ``signature.public_key_hex``, and the key published at
/site-signer.ed25519.pub -- and any disagreement is a hard failure. Pass
``--expect-key HEX`` with a value you obtained out-of-band to detect a key swap;
without that pin, a valid signature only tells you the manifest is
self-consistent (see "What a PASS does NOT prove" in the output).

DEPENDENCIES
------------
Prefers the ``cryptography`` library. If it is not installed, falls back to the
``openssl`` binary (OpenSSL 3.x; the raw 32-byte key is wrapped in a 12-byte
Ed25519 SPKI header and verified with ``openssl pkeyutl -verify -rawin``).
The signature check is never skipped: if neither backend works, the script
fails loudly with exit code 6. Each backend is sanity-checked with an ephemeral
sign/verify round-trip plus a tampered-signature negative control before its
verdict on the real manifest is trusted, so an openssl that is too old to
support these flags is reported as an unusable backend rather than as a bad
signature.

EXIT CODES
----------
    0  VERIFIED -- signature valid and every checked file's SHA-256 matches
    2  usage error (bad flags, or --file naming a path not in the manifest)
    3  signature / key failure -- bad signature, key disagreement, failed
       --expect-key pin, or unexpected schema. Step 2 is NOT run in this case:
       an unauthenticated manifest is not worth hashing against.
    4  hash mismatch -- signature valid, but at least one file's bytes differ
       from the signed digest
    5  fetch / transport error -- the manifest, the public key, or a listed
       file could not be retrieved
    6  no usable ed25519 verification backend

USAGE
-----
    python3 verify_site_integrity.py
    python3 verify_site_integrity.py --url https://secure.imagineqira.com
    python3 verify_site_integrity.py --expect-key 881de4e7...d326
    python3 verify_site_integrity.py --file vault/index.html
    python3 verify_site_integrity.py --site-root /path/to/webroot   # check a local tree
    python3 verify_site_integrity.py --json
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

DEFAULT_URL = "https://secure.imagineqira.com"
MANIFEST_PATH = "/site-integrity.json"
PUBKEY_PATH = "/site-signer.ed25519.pub"

# Hard-coded on purpose: never taken from the manifest under verification.
SIGNATURE_DOMAIN = b"BRY-NFET-SX|SITE-INTEGRITY|V2"
EXPECTED_SCHEMA = "BRY-NFET-SX-SITE-INTEGRITY-V2"

# DER prefix for an Ed25519 SubjectPublicKeyInfo: SEQUENCE(42) {
#   SEQUENCE(5) { OID 1.3.101.112 }, BIT STRING(33) { 0x00 || <32 raw bytes> } }
ED25519_SPKI_PREFIX = bytes.fromhex("302a300506032b6570032100")

USER_AGENT = "qev-site-integrity-verifier/1.0 (+https://secure.imagineqira.com/verify)"
CHUNK_BYTES = 256 * 1024

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_SIGNATURE = 3
EXIT_HASH_MISMATCH = 4
EXIT_TRANSPORT = 5
EXIT_NO_BACKEND = 6


class TransportError(Exception):
    """A manifest, key, or file could not be retrieved. Maps to exit 5."""


class BackendUnavailable(Exception):
    """No working ed25519 verification backend. Maps to exit 6."""


# --------------------------------------------------------------------------
# Transport (read-only: GET and local reads only)
# --------------------------------------------------------------------------


def _is_url(ref: str) -> bool:
    return ref.startswith(("http://", "https://"))


def fetch_bytes(url: str, timeout: float) -> bytes:
    """GET a URL and return its raw body, or raise TransportError."""
    request = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": USER_AGENT,
            # Hash the bytes as stored, not a transfer-encoded variant.
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        raise TransportError(f"{url}: HTTP {exc.code} {exc.reason}") from exc
    except Exception as exc:  # URLError, timeout, ssl, ...
        raise TransportError(f"{url}: {type(exc).__name__}: {exc}") from exc


def read_source(ref: str, timeout: float) -> bytes:
    """Read a URL or a local path."""
    if _is_url(ref):
        return fetch_bytes(ref, timeout)
    try:
        return Path(ref).expanduser().read_bytes()
    except OSError as exc:
        raise TransportError(f"{ref}: {exc}") from exc


def sha256_of_url(url: str, timeout: float) -> str:
    """Stream a URL and return its SHA-256 hex digest."""
    request = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
        },
    )
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            while True:
                chunk = response.read(CHUNK_BYTES)
                if not chunk:
                    break
                digest.update(chunk)
    except urllib.error.HTTPError as exc:
        raise TransportError(f"HTTP {exc.code} {exc.reason}") from exc
    except Exception as exc:
        raise TransportError(f"{type(exc).__name__}: {exc}") from exc
    return digest.hexdigest()


def sha256_of_path(path: Path) -> str:
    """Stream a local file and return its SHA-256 hex digest."""
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(CHUNK_BYTES)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError as exc:
        raise TransportError(str(exc)) from exc
    return digest.hexdigest()


# --------------------------------------------------------------------------
# Canonicalization -- the load-bearing function
# --------------------------------------------------------------------------


def canonical_manifest_bytes(record: Dict[str, Any]) -> bytes:
    """Return the canonical JSON bytes of the record minus its signature block.

    json.dumps(manifest_without_signature, sort_keys=True,
               separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    """
    manifest = {key: value for key, value in record.items() if key != "signature"}
    return json.dumps(
        manifest,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def signed_bytes(record: Dict[str, Any]) -> bytes:
    """Reconstruct the exact byte string the signer signed.

    Domain separator immediately followed by the canonical manifest JSON --
    no trailing "||", no separator, no newline.
    """
    return SIGNATURE_DOMAIN + canonical_manifest_bytes(record)


# --------------------------------------------------------------------------
# ed25519 verification backends
# --------------------------------------------------------------------------


class Ed25519Backend:
    """A means of checking an ed25519 signature. Subclasses must not mutate state."""

    name = "abstract"

    def describe(self) -> str:
        return self.name

    def verify(self, public_key: bytes, signature: bytes, message: bytes) -> bool:
        raise NotImplementedError

    def _sign_for_selftest(self) -> Tuple[bytes, bytes, bytes]:
        """Return (public_key, signature, message) for an ephemeral keypair."""
        raise NotImplementedError

    def self_check(self) -> None:
        """Prove this backend can verify at all, and rejects a bad signature.

        Raises BackendUnavailable if the backend cannot round-trip. This runs
        before the real manifest is judged so that a backend which is missing,
        too old, or built without ed25519 is reported as unusable rather than
        being allowed to call a good signature forged.
        """
        try:
            public_key, signature, message = self._sign_for_selftest()
            positive = self.verify(public_key, signature, message)
            tampered = bytearray(signature)
            tampered[0] ^= 0x01
            negative = self.verify(public_key, bytes(tampered), message)
        except BackendUnavailable:
            raise
        except Exception as exc:
            raise BackendUnavailable(f"{self.name}: self-check errored: {exc}") from exc
        if not positive:
            raise BackendUnavailable(
                f"{self.name}: rejected a signature it just produced"
            )
        if negative:
            raise BackendUnavailable(
                f"{self.name}: accepted a corrupted signature (unusable)"
            )


class CryptographyBackend(Ed25519Backend):
    """Preferred backend: the Python 'cryptography' library."""

    name = "cryptography"

    def __init__(self) -> None:
        try:
            from cryptography.hazmat.primitives.asymmetric import ed25519
        except Exception as exc:
            raise BackendUnavailable(f"cryptography not importable: {exc}") from exc
        self._ed25519 = ed25519
        try:
            import cryptography

            self._version = getattr(cryptography, "__version__", "unknown")
        except Exception:
            self._version = "unknown"

    def describe(self) -> str:
        return f"cryptography {self._version}"

    def verify(self, public_key: bytes, signature: bytes, message: bytes) -> bool:
        loaded = self._ed25519.Ed25519PublicKey.from_public_bytes(public_key)
        try:
            loaded.verify(signature, message)
        except Exception:
            return False
        return True

    def _sign_for_selftest(self) -> Tuple[bytes, bytes, bytes]:
        from cryptography.hazmat.primitives import serialization

        private = self._ed25519.Ed25519PrivateKey.generate()
        message = b"qev-site-integrity-verifier self-check"
        signature = private.sign(message)
        public_key = private.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return public_key, signature, message


class OpenSSLBackend(Ed25519Backend):
    """Fallback backend: the openssl binary (needs OpenSSL 3.x for -rawin)."""

    name = "openssl"

    def __init__(self, binary: str = "openssl") -> None:
        resolved = shutil.which(binary) or (binary if os.path.isfile(binary) else None)
        if resolved is None:
            raise BackendUnavailable(f"openssl binary not found: {binary}")
        self._binary = resolved
        self._version = self._probe_version()

    def _probe_version(self) -> str:
        try:
            done = subprocess.run(
                [self._binary, "version"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            return done.stdout.strip() or "unknown"
        except Exception:
            return "unknown"

    def describe(self) -> str:
        return f"{self._binary} ({self._version})"

    def _run(self, args: Sequence[str]) -> subprocess.CompletedProcess:
        try:
            return subprocess.run(
                [self._binary, *args],
                capture_output=True,
                timeout=120,
                check=False,
            )
        except Exception as exc:
            raise BackendUnavailable(f"openssl invocation failed: {exc}") from exc

    def verify(self, public_key: bytes, signature: bytes, message: bytes) -> bool:
        if len(public_key) != 32:
            raise BackendUnavailable(
                f"expected a 32-byte raw ed25519 key, got {len(public_key)}"
            )
        with tempfile.TemporaryDirectory(prefix="qev-verify-") as workdir:
            work = Path(workdir)
            key_der = work / "signer.spki.der"
            sig_bin = work / "signature.bin"
            msg_bin = work / "message.bin"
            key_der.write_bytes(ED25519_SPKI_PREFIX + public_key)
            sig_bin.write_bytes(signature)
            msg_bin.write_bytes(message)
            done = self._run(
                [
                    "pkeyutl",
                    "-verify",
                    "-pubin",
                    "-inkey",
                    str(key_der),
                    "-keyform",
                    "DER",
                    "-rawin",
                    "-in",
                    str(msg_bin),
                    "-sigfile",
                    str(sig_bin),
                ]
            )
        combined = (done.stdout or b"") + (done.stderr or b"")
        if done.returncode == 0 and b"Verified Successfully" in combined:
            return True
        # Distinguish "this openssl cannot do the job" from "signature is bad".
        # A usage/capability complaint must never be reported as a forgery.
        lowered = combined.lower()
        capability_markers = (
            b"unknown option",
            b"unrecognized flag",
            b"usage:",
            b"invalid command",
            b"unsupported algorithm",
            b"operation not supported",
        )
        if any(marker in lowered for marker in capability_markers):
            raise BackendUnavailable(
                "openssl rejected the ed25519 raw-verify invocation "
                f"(needs OpenSSL 3.x): {combined.decode('utf-8', 'replace').strip()}"
            )
        return False

    def _sign_for_selftest(self) -> Tuple[bytes, bytes, bytes]:
        message = b"qev-site-integrity-verifier self-check"
        with tempfile.TemporaryDirectory(prefix="qev-selftest-") as workdir:
            work = Path(workdir)
            key_pem = work / "ephemeral.pem"
            pub_der = work / "ephemeral.pub.der"
            msg_bin = work / "message.bin"
            sig_bin = work / "signature.bin"
            msg_bin.write_bytes(message)

            done = self._run(
                ["genpkey", "-algorithm", "ED25519", "-out", str(key_pem)]
            )
            if done.returncode != 0:
                raise BackendUnavailable(
                    "openssl cannot generate an ed25519 key: "
                    + (done.stderr or b"").decode("utf-8", "replace").strip()
                )
            done = self._run(
                [
                    "pkey",
                    "-in",
                    str(key_pem),
                    "-pubout",
                    "-outform",
                    "DER",
                    "-out",
                    str(pub_der),
                ]
            )
            if done.returncode != 0:
                raise BackendUnavailable(
                    "openssl cannot export an ed25519 public key: "
                    + (done.stderr or b"").decode("utf-8", "replace").strip()
                )
            done = self._run(
                [
                    "pkeyutl",
                    "-sign",
                    "-inkey",
                    str(key_pem),
                    "-rawin",
                    "-in",
                    str(msg_bin),
                    "-out",
                    str(sig_bin),
                ]
            )
            if done.returncode != 0:
                raise BackendUnavailable(
                    "openssl cannot raw-sign with ed25519 (needs OpenSSL 3.x): "
                    + (done.stderr or b"").decode("utf-8", "replace").strip()
                )
            spki = pub_der.read_bytes()
            if not spki.startswith(ED25519_SPKI_PREFIX):
                raise BackendUnavailable(
                    "unexpected ed25519 SPKI layout from openssl pkey -pubout"
                )
            public_key = spki[len(ED25519_SPKI_PREFIX) :]
            signature = sig_bin.read_bytes()
        return public_key, signature, message


def select_backend(preference: str, openssl_binary: str) -> Ed25519Backend:
    """Pick a verification backend, self-checking it before returning it."""
    attempts: List[str] = []
    order: List[str]
    if preference == "cryptography":
        order = ["cryptography"]
    elif preference == "openssl":
        order = ["openssl"]
    else:
        order = ["cryptography", "openssl"]

    for choice in order:
        try:
            backend: Ed25519Backend = (
                CryptographyBackend()
                if choice == "cryptography"
                else OpenSSLBackend(openssl_binary)
            )
            backend.self_check()
            return backend
        except BackendUnavailable as exc:
            attempts.append(str(exc))

    raise BackendUnavailable(
        "no usable ed25519 backend. Install the 'cryptography' library "
        "(pip install cryptography) or an OpenSSL 3.x binary. Tried:\n  - "
        + "\n  - ".join(attempts)
    )


# --------------------------------------------------------------------------
# Step 1 -- signature and key checks
# --------------------------------------------------------------------------


def normalize_hex_key(raw: str, label: str) -> str:
    key = raw.strip().lower()
    if len(key) != 64 or any(char not in "0123456789abcdef" for char in key):
        raise ValueError(f"{label}: expected 64 hex characters, got {raw.strip()!r}")
    return key


def collect_key_claims(
    record: Dict[str, Any], published_key: Optional[str]
) -> Tuple[Dict[str, str], List[str]]:
    """Gather every published claim about the signing key."""
    claims: Dict[str, str] = {}
    problems: List[str] = []

    signer = record.get("signer")
    if isinstance(signer, dict) and signer.get("public_key_hex"):
        try:
            claims["manifest.signer.public_key_hex"] = normalize_hex_key(
                str(signer["public_key_hex"]), "manifest.signer.public_key_hex"
            )
        except ValueError as exc:
            problems.append(str(exc))

    signature = record.get("signature")
    if isinstance(signature, dict) and signature.get("public_key_hex"):
        try:
            claims["manifest.signature.public_key_hex"] = normalize_hex_key(
                str(signature["public_key_hex"]), "manifest.signature.public_key_hex"
            )
        except ValueError as exc:
            problems.append(str(exc))

    if published_key is not None:
        claims[PUBKEY_PATH] = published_key

    if not claims:
        problems.append("no signing key found in the manifest or at " + PUBKEY_PATH)

    distinct = sorted(set(claims.values()))
    if len(distinct) > 1:
        detail = ", ".join(f"{source}={value}" for source, value in sorted(claims.items()))
        problems.append(f"signing key claims disagree: {detail}")

    return claims, problems


def stale_canonicalization_note(record: Dict[str, Any]) -> Optional[str]:
    """Detect the known-wrong 'trailing ||' description inside the record."""
    signature = record.get("signature")
    if not isinstance(signature, dict):
        return None
    note = signature.get("canonical_json_note")
    if isinstance(note, str) and "V2||" in note:
        return note
    return None


# --------------------------------------------------------------------------
# Step 2 -- file hashes
# --------------------------------------------------------------------------


class FileResult:
    __slots__ = ("name", "expected", "actual", "status", "detail")

    def __init__(
        self,
        name: str,
        expected: str,
        actual: Optional[str],
        status: str,
        detail: str = "",
    ) -> None:
        self.name = name
        self.expected = expected
        self.actual = actual
        self.status = status  # "ok" | "mismatch" | "error"
        self.detail = detail


def file_source_for(name: str, base_url: str, site_root: Optional[Path]) -> str:
    if site_root is not None:
        return str(site_root / name)
    return base_url.rstrip("/") + "/" + urllib.parse.quote(name, safe="/")


def hash_one(
    name: str,
    expected: str,
    base_url: str,
    site_root: Optional[Path],
    timeout: float,
) -> FileResult:
    try:
        if site_root is not None:
            actual = sha256_of_path(site_root / name)
        else:
            actual = sha256_of_url(file_source_for(name, base_url, None), timeout)
    except TransportError as exc:
        return FileResult(name, expected, None, "error", str(exc))
    status = "ok" if actual == expected.strip().lower() else "mismatch"
    return FileResult(name, expected, actual, status)


def check_files(
    files: Dict[str, str],
    base_url: str,
    site_root: Optional[Path],
    timeout: float,
    workers: int,
) -> List[FileResult]:
    names = list(files.keys())
    results: Dict[str, FileResult] = {}
    if not names:
        return []
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, min(workers, len(names)))
    ) as pool:
        futures = {
            pool.submit(
                hash_one, name, str(files[name]), base_url, site_root, timeout
            ): name
            for name in names
        }
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            results[name] = future.result()
    return [results[name] for name in names]


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------

SIGNATURE_PROVES = [
    "The manifest was signed by whoever holds the ed25519 private key whose "
    "public half is printed above. Anyone can check this locally; no "
    "cooperation from the operator is required.",
    "The file list is itself inside the signed bytes, so silently adding or "
    "removing entries breaks the signature.",
]

PASS_DOES_NOT_PROVE = [
    "That the key belongs to who you think it does. Verify it out-of-band and "
    "pin it with --expect-key. An attacker who controlled this site could "
    "publish their own key beside their own forged manifest, and it would verify.",
    "That the code inside the hashed HTML/JS is free of bugs. Hash integrity is "
    "not code correctness.",
    "That files NOT in the manifest are untampered. Anything outside the file "
    "list is out of scope.",
    "That the operator is trustworthy -- only that one party holding one "
    "ed25519 key signed one specific manifest at one specific moment.",
]


def wrap_bullet(text: str, width: int = 78, indent: str = "    ") -> List[str]:
    words = text.split()
    lines: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) + len(indent) > width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def print_caveats(files_checked: int, files_listed: int) -> None:
    """State the bounded meaning of this run.

    The "proves" list is built from what this run actually did: the file-hash
    bullet is only claimed for the files that were really hashed, and the
    unchecked remainder is named explicitly. A run that skipped step 2 must not
    imply anything about file bytes.
    """

    def bullets(header: str, items: List[str]) -> None:
        print()
        print(header)
        for bullet in items:
            wrapped = wrap_bullet(bullet)
            print(f"  * {wrapped[0]}")
            for line in wrapped[1:]:
                print(f"    {line}")

    proves = list(SIGNATURE_PROVES)
    not_proves = list(PASS_DOES_NOT_PROVE)

    if files_checked == 0:
        not_proves.insert(
            0,
            "Anything about the bytes actually served. This run checked only the "
            f"signature; none of the {files_listed} listed file(s) were hashed.",
        )
    elif files_checked == files_listed:
        proves.insert(
            1,
            f"Every byte of all {files_listed} file(s) listed in the manifest "
            "matches the SHA-256 digest recorded in that signed manifest.",
        )
    else:
        proves.insert(
            1,
            f"The {files_checked} file(s) checked in this run match their SHA-256 "
            "digests in the signed manifest.",
        )
        not_proves.insert(
            0,
            f"Anything about the other {files_listed - files_checked} file(s) "
            "listed in the manifest. This run hashed only a subset; drop --file "
            "to check them all.",
        )

    bullets("What this run proves", proves)
    bullets("What it does NOT prove", not_proves)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="verify_site_integrity.py",
        description=(
            "Verify the ed25519-signed site-integrity manifest and the SHA-256 "
            "digest of every file it lists. Read-only."
        ),
        epilog=(
            "exit codes: 0 verified | 2 usage | 3 signature/key failure | "
            "4 hash mismatch | 5 fetch error | 6 no ed25519 backend"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"site base URL (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--manifest",
        help="read the manifest from this local path or URL instead of <url>"
        + MANIFEST_PATH,
    )
    parser.add_argument(
        "--pubkey",
        help="read the signer public key from this local path or URL instead of "
        "<url>" + PUBKEY_PATH,
    )
    parser.add_argument(
        "--expect-key",
        metavar="HEX",
        help="pin the expected 64-hex-character ed25519 public key; any "
        "disagreement fails with exit 3 (use a value obtained out-of-band)",
    )
    parser.add_argument(
        "--site-root",
        metavar="DIR",
        help="hash files from this local directory instead of fetching them "
        "(useful for checking a webroot or checkout against the signed manifest)",
    )
    parser.add_argument(
        "--file",
        metavar="PATH",
        help="check only this one manifest entry (e.g. vault/index.html). The "
        "signature is still verified first.",
    )
    parser.add_argument(
        "--backend",
        choices=("auto", "cryptography", "openssl"),
        default="auto",
        help="ed25519 verification backend (default: auto -- cryptography, then openssl)",
    )
    parser.add_argument(
        "--openssl",
        default="openssl",
        help="openssl binary to use for the fallback backend (default: openssl)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="per-request timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="concurrent fetches for the file-hash step (default: 8)",
    )
    parser.add_argument(
        "--skip-files",
        action="store_true",
        help="run only step 1 (signature); do not hash any file",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="emit a machine-readable JSON report on stdout and nothing else",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="suppress the per-file OK lines (mismatches are always shown)",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="check that an ed25519 backend works, then exit without touching "
        "the network",
    )
    return parser


def emit(report: Dict[str, Any], as_json: bool, code: int) -> int:
    if as_json:
        report["exit_code"] = code
        print(json.dumps(report, indent=2, sort_keys=True))
    return code


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    as_json = args.as_json
    report: Dict[str, Any] = {"result": "UNKNOWN", "warnings": []}

    def say(*parts: str) -> None:
        if not as_json:
            print(*parts)

    def warn(message: str) -> None:
        report["warnings"].append(message)
        if not as_json:
            print(f"  ! {message}")

    # ---- backend selection (never silently skipped) ----------------------
    try:
        backend = select_backend(args.backend, args.openssl)
    except BackendUnavailable as exc:
        report["result"] = "NO_BACKEND"
        report["error"] = str(exc)
        if not as_json:
            print(f"ERROR: {exc}", file=sys.stderr)
        return emit(report, as_json, EXIT_NO_BACKEND)

    report["backend"] = backend.describe()
    if args.self_test:
        report["result"] = "BACKEND_OK"
        say(f"ed25519 backend OK: {backend.describe()}")
        say("  ephemeral sign/verify round-trip passed, corrupted signature rejected")
        return emit(report, as_json, EXIT_OK)

    base_url = args.url.rstrip("/")
    manifest_ref = args.manifest or (base_url + MANIFEST_PATH)
    pubkey_ref = args.pubkey or (base_url + PUBKEY_PATH)
    site_root: Optional[Path] = None
    if args.site_root:
        site_root = Path(args.site_root).expanduser().resolve()
        if not site_root.is_dir():
            parser.error(f"--site-root is not a directory: {site_root}")

    if args.expect_key:
        try:
            expect_key: Optional[str] = normalize_hex_key(args.expect_key, "--expect-key")
        except ValueError as exc:
            parser.error(str(exc))
    else:
        expect_key = None

    report["target"] = {
        "url": base_url,
        "manifest": manifest_ref,
        "pubkey": pubkey_ref,
        "site_root": str(site_root) if site_root else None,
    }

    say("QEV site-integrity verifier (read-only)")
    say(f"  manifest    : {manifest_ref}")
    say(f"  public key  : {pubkey_ref}")
    say(f"  file source : {site_root if site_root else base_url + '/<path>'}")
    say(f"  backend     : {backend.describe()}")

    # ---- load manifest and key ------------------------------------------
    try:
        manifest_raw = read_source(manifest_ref, args.timeout)
    except TransportError as exc:
        report["result"] = "TRANSPORT_ERROR"
        report["error"] = f"could not read manifest: {exc}"
        if not as_json:
            print(f"ERROR: could not read manifest: {exc}", file=sys.stderr)
        return emit(report, as_json, EXIT_TRANSPORT)

    try:
        record = json.loads(manifest_raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        report["result"] = "TRANSPORT_ERROR"
        report["error"] = f"manifest is not valid UTF-8 JSON: {exc}"
        if not as_json:
            print(f"ERROR: manifest is not valid UTF-8 JSON: {exc}", file=sys.stderr)
        return emit(report, as_json, EXIT_TRANSPORT)
    if not isinstance(record, dict):
        report["result"] = "TRANSPORT_ERROR"
        report["error"] = "manifest is not a JSON object"
        if not as_json:
            print("ERROR: manifest is not a JSON object", file=sys.stderr)
        return emit(report, as_json, EXIT_TRANSPORT)

    published_key: Optional[str] = None
    try:
        published_key = normalize_hex_key(
            read_source(pubkey_ref, args.timeout).decode("utf-8", "replace"),
            pubkey_ref,
        )
    except TransportError as exc:
        report["result"] = "TRANSPORT_ERROR"
        report["error"] = f"could not read public key: {exc}"
        if not as_json:
            print(f"ERROR: could not read public key: {exc}", file=sys.stderr)
        return emit(report, as_json, EXIT_TRANSPORT)
    except ValueError as exc:
        # A malformed published key is a trust failure, not a transport one.
        say()
        say("Step 1: ed25519 signature over the manifest")
        report["result"] = "SIGNATURE_FAILED"
        report["error"] = str(exc)
        if not as_json:
            print(f"  FAIL - {exc}", file=sys.stderr)
        return emit(report, as_json, EXIT_SIGNATURE)

    # ---- Step 1: signature ----------------------------------------------
    say()
    say("Step 1: ed25519 signature over the manifest")

    signature_block = record.get("signature")
    schema = record.get("schema")
    say(f"  schema      : {schema}")
    say(f"  site        : {record.get('site')}")
    say(f"  signed_at   : {record.get('signed_at')}")
    say(f"  file_count  : {record.get('file_count')}")

    report["manifest"] = {
        "schema": schema,
        "site": record.get("site"),
        "signed_at": record.get("signed_at"),
        "file_count": record.get("file_count"),
    }

    failures: List[str] = []
    if schema != EXPECTED_SCHEMA:
        failures.append(f"unexpected schema {schema!r} (expected {EXPECTED_SCHEMA!r})")

    if not isinstance(signature_block, dict) or not signature_block.get("signature_hex"):
        failures.append("manifest has no signature.signature_hex")
        signature_hex = ""
    else:
        signature_hex = str(signature_block["signature_hex"]).strip().lower()
        algorithm = signature_block.get("algorithm") or signature_block.get("scheme")
        if algorithm not in (None, "ed25519"):
            failures.append(f"unexpected signature algorithm {algorithm!r}")
        declared_domain = signature_block.get("domain")
        if (
            isinstance(declared_domain, str)
            and declared_domain.encode("utf-8") != SIGNATURE_DOMAIN
        ):
            warn(
                "manifest declares signature.domain="
                f"{declared_domain!r}, which differs from the domain separator "
                "this verifier pins; verifying against the pinned value"
            )

    claims, key_problems = collect_key_claims(record, published_key)
    failures.extend(key_problems)
    key_hex = published_key or (sorted(claims.values())[0] if claims else None)

    if expect_key is not None:
        report["pinned_key"] = expect_key
        disagreeing = {
            source: value for source, value in claims.items() if value != expect_key
        }
        if disagreeing:
            detail = ", ".join(f"{s}={v}" for s, v in sorted(disagreeing.items()))
            failures.append(f"--expect-key pin {expect_key} does not match: {detail}")

    if key_hex is not None:
        agreement = (
            "all sources agree"
            if len(set(claims.values())) == 1
            else "SOURCES DISAGREE"
        )
        say(f"  signer key  : {key_hex}")
        say(f"                ({len(claims)} published source(s), {agreement})")
    report["key_claims"] = claims

    message = signed_bytes(record)
    canonical_len = len(message) - len(SIGNATURE_DOMAIN)
    say(
        f"  domain sep  : {SIGNATURE_DOMAIN.decode()} "
        f"({len(SIGNATURE_DOMAIN)} bytes, no trailing pipes, no newline)"
    )
    say(
        f"  canonical   : {canonical_len} bytes "
        "(sort_keys, separators=(',',':'), ensure_ascii=False)"
    )
    report["canonicalization"] = {
        "domain_separator": SIGNATURE_DOMAIN.decode(),
        "domain_separator_bytes": len(SIGNATURE_DOMAIN),
        "canonical_json_bytes": canonical_len,
        "signed_bytes_total": len(message),
        "json_dumps_kwargs": {
            "sort_keys": True,
            "separators": [",", ":"],
            "ensure_ascii": False,
        },
    }

    signature_ok = False
    if not failures and key_hex is not None and signature_hex:
        try:
            signature_bytes = bytes.fromhex(signature_hex)
        except ValueError:
            failures.append("signature.signature_hex is not valid hex")
            signature_bytes = b""
        if signature_bytes:
            if len(signature_bytes) != 64:
                failures.append(
                    f"ed25519 signature must be 64 bytes, got {len(signature_bytes)}"
                )
            else:
                try:
                    signature_ok = backend.verify(
                        bytes.fromhex(key_hex), signature_bytes, message
                    )
                except BackendUnavailable as exc:
                    report["result"] = "NO_BACKEND"
                    report["error"] = str(exc)
                    if not as_json:
                        print(f"ERROR: {exc}", file=sys.stderr)
                    return emit(report, as_json, EXIT_NO_BACKEND)
                if not signature_ok:
                    failures.append(
                        "ed25519 signature does NOT verify over the canonical "
                        "manifest bytes"
                    )

    report["signature"] = {
        "ok": bool(signature_ok and not failures),
        "backend": backend.describe(),
        "signature_hex": signature_hex or None,
        "public_key_hex": key_hex,
        "problems": failures,
    }

    stale_note = stale_canonicalization_note(record)
    if stale_note is not None:
        warn(
            "the record's own signature.canonical_json_note describes the domain "
            "separator with a trailing '||'. That form does NOT verify. The bytes "
            "that verify use the separator with no trailing pipes, as this "
            "verifier does."
        )
        report["stale_canonical_json_note"] = stale_note

    if failures or not signature_ok:
        if not as_json:
            print("  FAIL - manifest signature/key check failed:")
            for problem in failures or ["signature did not verify"]:
                print(f"         - {problem}")
            print()
            print(
                "  Step 2 (file hashes) was NOT run: an unauthenticated manifest\n"
                "  is not worth hashing against."
            )
        report["result"] = "SIGNATURE_FAILED"
        return emit(report, as_json, EXIT_SIGNATURE)

    say("  OK - signature valid over the canonical manifest bytes")
    if expect_key is not None:
        say(f"  OK - key matches the --expect-key pin {expect_key}")
    else:
        warn(
            "no --expect-key pin given, so this run does not rule out a key swap; "
            "confirm the key out-of-band"
        )

    # ---- Step 2: file hashes --------------------------------------------
    files_field = record.get("files")
    if not isinstance(files_field, dict):
        report["result"] = "SIGNATURE_FAILED"
        report["error"] = "manifest has no 'files' object"
        if not as_json:
            print("ERROR: manifest has no 'files' object", file=sys.stderr)
        return emit(report, as_json, EXIT_SIGNATURE)
    files: Dict[str, str] = {str(k): str(v) for k, v in files_field.items()}
    files_listed = len(files)

    # Both values are inside the signed bytes, so a disagreement is a signer-side
    # bookkeeping bug rather than tampering -- but it should still be visible.
    declared_count = record.get("file_count")
    if isinstance(declared_count, int) and declared_count != files_listed:
        warn(
            f"manifest declares file_count={declared_count} but lists "
            f"{files_listed} file(s); checking the {files_listed} entries "
            "actually present"
        )

    if args.skip_files:
        say()
        say("Step 2: skipped (--skip-files)")
        report["result"] = "SIGNATURE_ONLY"
        report["files"] = {"checked": 0, "listed": files_listed, "skipped": True}
        if not as_json:
            print()
            print("SIGNATURE VERIFIED. File hashes were NOT checked.")
            print_caveats(0, files_listed)
        return emit(report, as_json, EXIT_OK)

    if args.file:
        wanted = args.file.lstrip("/")
        if wanted not in files:
            report["result"] = "USAGE_ERROR"
            report["error"] = f"{wanted!r} is not listed in the manifest"
            if not as_json:
                print(
                    f"ERROR: {wanted!r} is not listed in the signed manifest. "
                    "Files outside the manifest are out of scope by design.",
                    file=sys.stderr,
                )
            return emit(report, as_json, EXIT_USAGE)
        files = {wanted: files[wanted]}

    say()
    say(f"Step 2: SHA-256 of {len(files)} file(s) listed in the manifest")
    results = check_files(files, base_url, site_root, args.timeout, args.workers)

    ok_count = 0
    mismatches: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    for result in results:
        if result.status == "ok":
            ok_count += 1
            if not args.quiet:
                say(f"  OK        {result.name}")
        elif result.status == "mismatch":
            mismatches.append(
                {
                    "name": result.name,
                    "expected": result.expected,
                    "actual": result.actual,
                }
            )
            say(f"  MISMATCH  {result.name}")
            say(f"              expected {result.expected}")
            say(f"              actual   {result.actual}")
        else:
            errors.append({"name": result.name, "error": result.detail})
            say(f"  ERROR     {result.name}: {result.detail}")

    report["files"] = {
        "checked": len(results),
        "listed": files_listed,
        "ok": ok_count,
        "mismatch": mismatches,
        "errors": errors,
    }
    say(f"  {ok_count}/{len(results)} file(s) match the signed digests")

    if errors:
        report["result"] = "TRANSPORT_ERROR"
        if not as_json:
            print()
            print(
                f"INCOMPLETE. {len(errors)} file(s) could not be retrieved, so the "
                "manifest\ncould not be fully checked. The signature itself is valid."
            )
        return emit(report, as_json, EXIT_TRANSPORT)

    if mismatches:
        report["result"] = "HASH_MISMATCH"
        if not as_json:
            print()
            print(
                f"FAILED. The signature is valid, but {len(mismatches)} file(s) do not\n"
                "match the digests in the signed manifest. The served bytes are not\n"
                "the bytes that were signed."
            )
        return emit(report, as_json, EXIT_HASH_MISMATCH)

    report["result"] = "VERIFIED"
    if not as_json:
        print()
        scope = (
            f"every file listed in the manifest matches its "
            f"SHA-256 digest ({ok_count}/{files_listed})."
            if len(results) == files_listed
            else (
                f"the {len(results)} file(s) checked in this run match their "
                f"SHA-256 digests ({ok_count}/{len(results)} of {files_listed} listed)."
            )
        )
        for line in wrap_bullet(
            "VERIFIED. The manifest is signed by the holder of the ed25519 private "
            f"key corresponding to the published public key, and {scope}",
            width=74,
            indent="",
        ):
            print(line)
        print_caveats(len(results), files_listed)
    return emit(report, as_json, EXIT_OK)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        sys.exit(EXIT_TRANSPORT)
