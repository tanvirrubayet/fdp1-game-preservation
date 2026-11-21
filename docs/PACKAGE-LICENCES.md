# Pilot package licence inventory

Reviewed 19 November 2026 against the recorded pilot ZIP. This inventory lists every bundled DLL with its SHA-256 in [package-components.json](package-components.json). Package names are inferred from filenames and the upstream MSYS2 build process. Current MSYS2 metadata identifies licence families. Exact binary versions and corresponding source matches remain unresolved. The SDL2_mixer, SDL2_net and SDL3 rows were checked against MSYS2 on 21 November 2026; MSYS2 now publishes the first two as `sdl2-mixer` and `sdl2-net`.

| Component | Checked material | Distribution rights and remaining verification |
| --- | --- | --- |
| Freedoom Phase 1 0.13.0 | COPYING.txt and credits are present | BSD 3-Clause permits redistribution with notices. Recipients retain those rights. |
| Crispy Doom 7.2.0 | COPYING.md and the engine source tarball are present | GPL v2 requires appropriate corresponding source and notices. Check the full build and dependency source coverage. |
| Windows libraries | 28 DLLs from the upstream release | The Windows ZIP contains executable files, DLLs and three HTML manuals. It has no individual library licence notices. Match each binary to its source and supply its applicable notices before treating the combined package as cleared for wider redistribution. |
| Play.cmd and package wrapper | Project-authored launcher and READ-ME | Provides local launch and settings paths. It adds no restriction to upstream software rights. |
| Original registered DOOM 1.1 | Historical case study | Publisher permission is required for a proposed public archive release. |

The test ZIP preserves the original fingerprint so the earlier evidence can be reproduced. A future package with corrected notices must receive a new manifest and be retested. Retain this inventory and record clearance per component as evidence becomes available.

| Bundled file | Upstream package reference | Current package licence metadata |
| --- | --- | --- |
| engine/SDL2.dll | [SDL2](https://packages.msys2.org/packages/mingw-w64-x86_64-SDL2) | Zlib |
| engine/SDL2_mixer.dll | [sdl2-mixer](https://packages.msys2.org/packages/mingw-w64-x86_64-sdl2-mixer) | Zlib |
| engine/SDL2_net.dll | [sdl2-net](https://packages.msys2.org/packages/mingw-w64-x86_64-sdl2-net) | Zlib |
| engine/SDL3.dll | [sdl3](https://packages.msys2.org/packages/mingw-w64-x86_64-sdl3) | Zlib |
| engine/libFLAC.dll | [flac](https://packages.msys2.org/packages/mingw-w64-x86_64-flac) | BSD-3-Clause AND GPL-2.0-or-later |
| engine/libfluidsynth-3.dll | [fluidsynth](https://packages.msys2.org/packages/mingw-w64-x86_64-fluidsynth) | LGPL-2.1-or-later |
| engine/libgcc_s_seh-1.dll | [gcc-libs](https://packages.msys2.org/packages/mingw-w64-x86_64-gcc-libs) | GPL-3.0-or-later WITH GCC-exception-3.1 AND GFDL-1.3-or-later |
| engine/libgomp-1.dll | [gcc-libs](https://packages.msys2.org/packages/mingw-w64-x86_64-gcc-libs) | GPL-3.0-or-later WITH GCC-exception-3.1 AND GFDL-1.3-or-later |
| engine/libiconv-2.dll | [libiconv](https://packages.msys2.org/packages/mingw-w64-x86_64-libiconv) | LGPL-2.1-or-later OR documentation:spdx:GPL-3.0-or-later |
| engine/libmp3lame-0.dll | [lame](https://packages.msys2.org/packages/mingw-w64-x86_64-lame) | LGPL |
| engine/libmpg123-0.dll | [mpg123](https://packages.msys2.org/packages/mingw-w64-x86_64-mpg123) | LGPL-2.1-or-later |
| engine/libogg-0.dll | [libogg](https://packages.msys2.org/packages/mingw-w64-x86_64-libogg) | BSD-3-Clause |
| engine/libopus-0.dll | [opus](https://packages.msys2.org/packages/mingw-w64-x86_64-opus) | BSD-3-Clause |
| engine/libopusfile-0.dll | [opusfile](https://packages.msys2.org/packages/mingw-w64-x86_64-opusfile) | BSD |
| engine/libpng16-16.dll | [libpng](https://packages.msys2.org/packages/mingw-w64-x86_64-libpng) | custom |
| engine/libportaudio.dll | [portaudio](https://packages.msys2.org/packages/mingw-w64-x86_64-portaudio) | custom |
| engine/libreadline8.dll | [readline](https://packages.msys2.org/packages/mingw-w64-x86_64-readline) | GPL-3.0-or-later |
| engine/libsamplerate-0.dll | [libsamplerate](https://packages.msys2.org/packages/mingw-w64-x86_64-libsamplerate) | BSD-2-Clause |
| engine/libsndfile-1.dll | [libsndfile](https://packages.msys2.org/packages/mingw-w64-x86_64-libsndfile) | LGPL-2.1-or-later |
| engine/libstdc++-6.dll | [gcc-libs](https://packages.msys2.org/packages/mingw-w64-x86_64-gcc-libs) | GPL-3.0-or-later WITH GCC-exception-3.1 AND GFDL-1.3-or-later |
| engine/libtermcap-0.dll | [termcap](https://packages.msys2.org/packages/mingw-w64-x86_64-termcap) | GPL-2.0-or-later |
| engine/libvorbis-0.dll | [libvorbis](https://packages.msys2.org/packages/mingw-w64-x86_64-libvorbis) | custom |
| engine/libvorbisenc-2.dll | [libvorbis](https://packages.msys2.org/packages/mingw-w64-x86_64-libvorbis) | custom |
| engine/libvorbisfile-3.dll | [libvorbis](https://packages.msys2.org/packages/mingw-w64-x86_64-libvorbis) | custom |
| engine/libwavpack-1.dll | [wavpack](https://packages.msys2.org/packages/mingw-w64-x86_64-wavpack) | BSD-3-Clause |
| engine/libwinpthread-1.dll | [libwinpthread](https://packages.msys2.org/packages/mingw-w64-x86_64-libwinpthread) | MIT AND BSD-3-Clause |
| engine/libxmp.dll | [libxmp](https://packages.msys2.org/packages/mingw-w64-x86_64-libxmp) | MIT |
| engine/zlib1.dll | [zlib](https://packages.msys2.org/packages/mingw-w64-x86_64-zlib) | Zlib |

A current package listing does not establish which historical build supplied a DLL. The GNU runtime exceptions and component-specific terms need individual consideration.

Sources include the [Freedoom versioned licence](https://github.com/freedoom/freedoom/blob/v0.13.0/COPYING.adoc), [Crispy Doom versioned licence](https://github.com/fabiangreffrath/crispy-doom/blob/crispy-doom-7.2/COPYING.md), [Crispy Doom build FAQ](https://github.com/fabiangreffrath/crispy-doom/wiki/FAQ) and [GNU GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html).
