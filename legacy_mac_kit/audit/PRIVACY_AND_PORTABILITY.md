# Private-data and source-selection audit

## Inventory and scope

The original project tree was enumerated before extraction: **37,221 files**, approximately **30.8 GB decimal bytes**. It contained downloaded game assets, data caches, shaders, binaries, original and modified APKs, screenshots, runtime traces, experimental copies, decoded payloads, Python environments and dozens of research directories. The source distribution is intentionally much smaller; it is **not** a mirror of the entire game or workspace.

Only selected `.py`, `.js`, `.lua`, `.sh`, `.json` configuration and related bootstrap source files were copied into this separate directory. Both the old `wzm` interface (for research/reference) and a safer managed `run.sh` entrypoint are included. Existing proprietary game assets were not copied. No phone installation was tested as part of creating this package.

## Sensitive material excluded

- Mac user-home/account-specific absolute paths and personal identifiers from copied source.
- Original ADB network address and any real device serial; each recipient configures their own externally.
- Game APKs and modified APKs, native ELF/DLL `.so` binaries, game FastFiles, asset packs, shaders and map shards.
- User screenshots, private screen captures, phone logs/logcats and crash traces.
- Stored sessions, game save data, personal configuration, private keys/certificates/keystores and downloaded account tokens.
- Local Python virtual environments and temporary generated deployment files.

Source-only files may still contain developer experiment comments, game-specific names, native offsets and third-party API identifiers. Those are **technical context**, not an endorsement of universal compatibility or a grant of redistribution rights.

## Reproducibility and blind spots

- Source manifest relative paths and SHA-256s: `INCLUDED_SOURCE_MANIFEST.json`.
- Aggregate file exclusion statistics: `SOURCE_SELECTION.json`.
- Repeatable source audit: `python3 tools/audit_source.py`.
- Original base APK checks are *pinned hashes only*. The user supplies its own matching original file to the bootstrap builder; no APK is packaged.
- The source audit scans every file in the distribution for strong personal-pattern indicators. It cannot mathematically prove absence of all possible secrets embedded in arbitrary code, and should be rerun on each revision.
- The output archive deliberately omits timestamps, UID/GID metadata and the developer's machine path by using only **relative archive member names**.

## Device compatibility limits

Frida and game-native offsets are tied to a specific ARM64 image and execution context. A different Android vendor kernel, root/SELinux strategy, ABI, installed asset corpus or version may prevent boot or match gameplay. Validated gameplay on a reference phone is **not** a cross-device test.
