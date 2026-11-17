"""Build one Windows package and seed separate copies for the two pilot archives."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
from shutil import copyfile
import tarfile
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


PACKAGE_NAME = "freedoom-phase1-pilot-win64.zip"
UPSTREAM = {
    "freedoom-0.13.0.zip": (
        "https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip",
        "3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59",
    ),
    "crispy-doom-7.2.0-win64.zip": (
        "https://github.com/fabiangreffrath/crispy-doom/releases/download/"
        "crispy-doom-7.2/crispy-doom-7.2.0-win64.zip",
        "c04feca63c00fd4c381c53cce8444a2bb520020be38368ce80da60484c94f2ab",
    ),
    "crispy-doom-7.2-source.tar.gz": (
        "https://api.github.com/repos/fabiangreffrath/crispy-doom/tarball/crispy-doom-7.2",
        "983c685d727806377a23cad8229266b2c1e29a3ca561c702e709f6906c865bc0",
    ),
}
README = """Freedoom Phase 1 preservation pilot for Windows x64

Extract the entire ZIP into a new folder. Double-click Play.cmd to start.
The game and its engine are included. The launcher stores settings and saved
games in the profile folder beside it. It uses no web installer.

This package contains Freedoom Phase 1 v0.13.0 and the Windows x64 Crispy Doom
7.2.0 engine. The notices, manuals and matching engine source are included.
The FDP1 prototype checks entitlement when the archive serves a download.
These upstream releases are available under their included licences.
"""

LAUNCHER = r"""@echo off
setlocal
pushd "%~dp0"
if not exist "profile\" mkdir "profile"
"engine\crispy-doom.exe" -iwad "freedoom1.wad" -config "profile\doom.cfg" -extraconfig "profile\crispy.cfg" -savedir "profile" %*
set "PLAY_RESULT=%ERRORLEVEL%"
popd
exit /b %PLAY_RESULT%
"""


def verified_inputs(folder):
    inputs = {}
    for name, (url, expected) in UPSTREAM.items():
        path = folder / name
        if not path.is_file():
            request = Request(url, headers={"User-Agent": "FDP1-preservation-pilot"})
            with urlopen(request, timeout=30) as response:
                path.write_bytes(response.read())
        data = path.read_bytes()
        if sha256(data).hexdigest() != expected:
            raise ValueError(f"Upstream SHA-256 check failed for {name}")
        inputs[name] = path
    return inputs


def add_file(output, name, data):
    # Pin ZIP entry metadata so rebuilding with the same inputs preserves its checksum.
    entry = ZipInfo(name)
    entry.compress_type = ZIP_DEFLATED
    output.writestr(entry, data, compresslevel=6)


def build(output_dir, inputs):
    output_dir.mkdir(parents=True, exist_ok=True)
    package = output_dir / PACKAGE_NAME
    with ZipFile(package, "w") as output:
        add_file(output, "READ-ME.txt", README.encode("utf-8"))
        add_file(output, "Play.cmd", LAUNCHER.replace("\n", "\r\n").encode("ascii"))

        with ZipFile(inputs["freedoom-0.13.0.zip"]) as freedoom:
            add_file(output, "freedoom1.wad", freedoom.read("freedoom-0.13.0/freedoom1.wad"))
            # Keep the upstream notices and manuals together with the selected WAD.
            for entry in sorted(freedoom.namelist()):
                name = Path(entry).name
                if not entry.endswith("/") and not name.lower().endswith(".wad"):
                    add_file(output, "notices/freedoom/" + name, freedoom.read(entry))

        with ZipFile(inputs["crispy-doom-7.2.0-win64.zip"]) as crispy:
            for name in sorted(crispy.namelist()):
                if name == "crispy-doom.exe" or name.endswith(".dll"):
                    add_file(output, "engine/" + name, crispy.read(name))
                elif name.endswith(".html"):
                    add_file(output, "notices/crispy-doom/" + name, crispy.read(name))

        source = inputs["crispy-doom-7.2-source.tar.gz"]
        with tarfile.open(source, "r:gz") as source_archive:
            copyright_file = next(item for item in source_archive.getmembers() if item.name.endswith("/COPYING.md"))
            add_file(output, "notices/crispy-doom/COPYING.md", source_archive.extractfile(copyright_file).read())
        add_file(output, "source/" + source.name, source.read_bytes())

    manifest = {
        "fileName": PACKAGE_NAME,
        "bytes": package.stat().st_size,
        "sha256": sha256(package.read_bytes()).hexdigest(),
        "platform": "Windows x64",
        "freedoomVersion": "0.13.0",
        "crispyDoomVersion": "7.2.0",
        "sources": [
            {"file": name, "url": url, "sha256": digest}
            for name, (url, digest) in UPSTREAM.items()
        ],
    }
    for host in ("primary", "backup"):
        # Give each archive a separate file and manifest.
        directory = output_dir / host
        directory.mkdir(exist_ok=True)
        copyfile(package, directory / PACKAGE_NAME)
        (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("archive-data"))
    parser.add_argument("--upstream-dir", type=Path)
    args = parser.parse_args()
    if args.upstream_dir:
        print(json.dumps(build(args.output, verified_inputs(args.upstream_dir))))
    else:
        with TemporaryDirectory(prefix="fdp1-upstream-") as folder:
            print(json.dumps(build(args.output, verified_inputs(Path(folder)))))


if __name__ == "__main__":
    main()
