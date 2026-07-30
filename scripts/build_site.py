#!/usr/bin/env python3
"""Assemble the secure.imagineqira.com webroot from its versioned sources.

WHY THIS EXISTS
    Until 2026-07-30 the live site could not be reproduced from any repo.
    It was assembled by hand from more than one directory, some of the
    content existed only as uncommitted working-tree edits, and five pages
    had no source on the operator's machine at all. "How do you build the
    site?" had no answer, which is the first question technical diligence
    asks.

    This script is the answer. One command, deterministic output.

WHAT PRODUCTION ACTUALLY CONTAINS
    Measured against the live signed manifest (75 files) on 2026-07-30:

      38 files  qev-desktop/landing/          the BRY-NFET-SX-era pages
      37 files  qev-platform/public-site/     the QEV-branded pages
       5 files  release binaries              .dmg/.exe/.msi/.apk - build
                                              outputs, in neither repo

    Five names exist in BOTH trees: contact.html, index.html, robots.txt,
    sitemap.xml and styles.css. Precedence was not documented anywhere; it
    was derived empirically by hashing each candidate against the live
    manifest. public-site wins all five, so it is layered second.

    Change that precedence only with evidence, not preference - it decides
    which homepage the world sees.

USAGE
    python3 scripts/build_site.py \
        --landing  ../qev-desktop/landing \
        --public   public-site \
        --releases ../qev-desktop/landing/downloads \
        --out      /tmp/webroot

    Then sign the ASSEMBLED tree (never one repo alone, or the manifest
    silently under-covers the site):

    python3 scripts/resign-site-integrity.py \
        --site-root /tmp/webroot --key /path/to/site-signer.ed25519.key
"""
from __future__ import annotations

import argparse
import filecmp
import hashlib
import json
import shutil
import sys
from pathlib import Path

# Never deploy these. docs/ and the rescue copies are reference material;
# shipping the rescue copies would republish the pre-remediation pages -
# including a false CSP claim - at live URLs.
# NB: do NOT exclude "docs" - public-site/docs/* IS deployed (8 live pages).
# The rescue copies live in qev-desktop/docs/, which is outside --landing
# entirely, so they are never reachable from here anyway.
EXCLUDE_DIRS = {"_deployed-rescue", ".git", "node_modules", "__pycache__"}
EXCLUDE_NAMES = {".DS_Store", "site-integrity.json", ".indexnow-key"}
EXCLUDE_SUFFIXES = (".bak", ".map", ".pyc", ".example")


def deployable(rel: Path) -> bool:
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if rel.name in EXCLUDE_NAMES or rel.name.startswith("._"):
        return False
    return not rel.name.endswith(EXCLUDE_SUFFIXES)


def layer(src: Path, out: Path, label: str, provenance: dict, collisions: list) -> int:
    n = 0
    for p in sorted(src.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(src)
        if not deployable(rel):
            continue
        dst = out / rel
        if dst.exists():
            same = filecmp.cmp(dst, p, shallow=False)
            collisions.append((str(rel), provenance[str(rel)], label, same))
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)
        provenance[str(rel)] = label
        n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description="Assemble the site webroot deterministically.")
    ap.add_argument("--landing", required=True, type=Path)
    ap.add_argument("--public", required=True, type=Path)
    ap.add_argument("--releases", type=Path, help="dir holding the .dmg/.exe/.msi/.apk")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--compare-manifest", type=Path,
                    help="a site-integrity.json to diff the result against")
    ap.add_argument("--clean", action="store_true", help="wipe --out first")
    a = ap.parse_args()

    for d in (a.landing, a.public):
        if not d.is_dir():
            print(f"ERROR: not a directory: {d}", file=sys.stderr)
            return 2

    if a.clean and a.out.exists():
        shutil.rmtree(a.out)
    a.out.mkdir(parents=True, exist_ok=True)

    provenance: dict[str, str] = {}
    collisions: list = []

    # Order matters: public-site is layered SECOND because it wins every
    # known collision. See the module docstring.
    n_landing = layer(a.landing, a.out, "landing", provenance, collisions)
    n_public = layer(a.public, a.out, "public-site", provenance, collisions)

    n_rel = 0
    if a.releases and a.releases.is_dir():
        dl = a.out / "downloads"
        dl.mkdir(parents=True, exist_ok=True)
        for p in sorted(a.releases.iterdir()):
            if p.is_file() and p.suffix.lower() in {".dmg", ".exe", ".msi", ".apk", ".sh"}:
                shutil.copy2(p, dl / p.name)
                provenance[f"downloads/{p.name}"] = "release"
                n_rel += 1

    total = sum(1 for p in a.out.rglob("*") if p.is_file())
    print(f"assembled {a.out}")
    print(f"  landing/      {n_landing}")
    print(f"  public-site/  {n_public}  (layered second - wins collisions)")
    print(f"  releases/     {n_rel}")
    print(f"  total files   {total}")

    if collisions:
        print(f"\ncollisions ({len(collisions)}) - public-site overwrote landing:")
        for rel, first, second, same in collisions:
            note = "identical" if same else "DIFFERENT content"
            print(f"  {rel:24} {first} -> {second}   {note}")

    if a.compare_manifest and a.compare_manifest.exists():
        want = json.loads(a.compare_manifest.read_text()).get("files", {})
        got = {}
        for p in a.out.rglob("*"):
            if p.is_file():
                got[str(p.relative_to(a.out))] = hashlib.sha256(p.read_bytes()).hexdigest()
        missing = sorted(set(want) - set(got))
        extra = sorted(set(got) - set(want))
        differing = sorted(f for f in set(want) & set(got) if want[f] != got[f])
        print(f"\nvs {a.compare_manifest.name}: {len(want)} expected, {len(got)} built")
        print(f"  missing from build : {len(missing)}")
        for f in missing[:10]:
            print(f"     {f}")
        print(f"  not in manifest    : {len(extra)}")
        for f in extra[:10]:
            print(f"     {f}")
        print(f"  content differs    : {len(differing)}"
              f"   (expected - the remediation changed these)")

    prov = a.out.parent / f"{a.out.name}.provenance.json"
    prov.write_text(json.dumps(provenance, indent=1, sort_keys=True) + "\n")
    print(f"\nprovenance -> {prov}")
    print("\nNEXT: sign the ASSEMBLED tree, not one repo:")
    print(f"  python3 scripts/resign-site-integrity.py --site-root {a.out} --key <key>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
