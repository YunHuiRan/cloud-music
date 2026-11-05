"""Replace assets/public inside an existing APK, dropping any existing signature.

Usage: python scripts/patch-apk.py <base.apk> <dist-dir> <work-dir> <out.apk>

The native Android project was lost in the 2026-10-30 cleanup, so releases are
built by patching the previously signed APK: every entry is copied as-is
(compression preserved, which keeps resources.arsc stored), old v1 signature
files are dropped, and assets/public is replaced with the fresh Vite build.
The result is unsigned and must be zipaligned and signed afterwards; see
scripts/apk.mjs.
"""

import os
import shutil
import sys
import zipfile
from pathlib import Path

SIGNATURE_SUFFIXES = (".RSA", ".DSA", ".EC", ".SF", ".MF")


def is_signature_file(name):
    return name.startswith("META-INF/") and name.upper().endswith(SIGNATURE_SUFFIXES)


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    dist = Path(sys.argv[2])
    work = Path(sys.argv[3])
    out = Path(sys.argv[4])

    if not (dist / "index.html").is_file():
        sys.exit(f"{dist} does not look like a Vite build (no index.html); run npm run build first")

    work.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zin:
        for info in zin.infolist():
            name = info.filename
            if info.is_dir() or is_signature_file(name):
                continue
            target = work / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with zin.open(info) as f, open(target, "wb") as g:
                shutil.copyfileobj(f, g)

    public = work / "assets" / "public"
    if public.exists():
        shutil.rmtree(public)
    shutil.copytree(dist, public)

    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w") as zout:
        seen = set()
        for info in zin.infolist():
            name = info.filename
            if info.is_dir() or name in seen:
                continue
            if name.startswith("assets/public/") or is_signature_file(name):
                continue
            seen.add(name)
            data = (work / name).read_bytes()
            zout.writestr(info, data, compress_type=info.compress_type)
        for root, dirs, files in os.walk(public):
            dirs.sort()
            for name in sorted(files):
                full = Path(root) / name
                rel = full.relative_to(work).as_posix()
                if rel in seen:
                    continue
                zout.write(full, rel, compress_type=zipfile.ZIP_DEFLATED)
    print(out)


if __name__ == "__main__":
    main()
