#!/usr/bin/env python3
"""Create a self-contained Chrome extension ZIP using Python's standard library."""

import json
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


def main():
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    if not re.fullmatch(r"\d+(?:\.\d+){0,3}", version):
        raise ValueError(f"Invalid extension version: {version!r}")

    files = [
        "manifest.json", "popup.html", "popup.css", "popup.js",
        "ipcalc.js", "oui-vendors.js", "ANLEITUNG.txt",
        *manifest["icons"].values(),
    ]
    if manifest["action"]["default_popup"] not in files:
        raise ValueError("The default popup is missing from the package file list")

    # Validate every input before replacing an existing release artifact.
    contents = {}
    for name in files:
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError(f"File is outside the extension directory: {name}")
        contents[name] = path.read_bytes()

    # Keep the recipient's versioned filenames accurate after a version bump.
    guide = contents["ANLEITUNG.txt"].decode("utf-8")
    guide = re.sub(r"subnetter-tools-\d+(?:\.\d+){0,3}", f"subnetter-tools-{version}", guide)
    guide = re.sub(r"SUBNETTER TOOLS \d+(?:\.\d+){0,3}", f"SUBNETTER TOOLS {version}", guide)
    contents["ANLEITUNG.txt"] = guide.encode("utf-8")

    folder = f"subnetter-tools-{version}"
    output = root / "dist"
    output.mkdir(exist_ok=True)
    archive = output / f"{folder}.zip"
    with NamedTemporaryFile(dir=output, suffix=".zip", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with ZipFile(temporary_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as package:
            for name, data in contents.items():
                # Fixed timestamps and modes make unchanged builds reproducible.
                entry = ZipInfo(f"{folder}/{name}", date_time=(2020, 1, 1, 0, 0, 0))
                entry.compress_type = ZIP_DEFLATED
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, data, compresslevel=9)
        with ZipFile(temporary_path) as package:
            damaged = package.testzip()
            if damaged:
                raise ValueError(f"ZIP integrity check failed: {damaged}")
        temporary_path.replace(archive)
    finally:
        temporary_path.unlink(missing_ok=True)
    print(f"Created {archive.relative_to(root)} ({archive.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
