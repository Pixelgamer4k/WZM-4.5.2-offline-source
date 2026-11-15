# Build the APK

The build turns your own original Warzone Mobile 4.5.2 split APKs into a signed, offline-capable set. Nothing here
contains game code; you supply that.

## 1. What you must supply

| Input | How to get it |
|---|---|
| The 5 original 4.5.2 split APKs | From a device/account that owns the game: `adb shell pm path com.activision.callofduty.warzone` lists 5 paths; `adb pull` each. They are `base.apk`, `split_config.arm64_v8a.apk`, `split_config.en.apk`, `split_config.xxxhdpi.apk`, `split_asset_pack.apk`. The build checks that `libgame.so` inside the arm64 split is sha256 `c8f5e9df…7d7` (build 22729281). A different build means every address in docs/05 is wrong. |
| Frida Gadget 17.x, android-arm64 | github.com/frida/frida → Releases → `frida-gadget-17.x.x-android-arm64.so.xz`. Unpack the `.xz` to a plain `.so`. |
| Signing key | You create it (step 3). |
| The 13 GB game data folder | For running, not building. See docs/03. |

## 2. Tools

- **Python 3.11+**
- **apktool** (brew/apt or the official jar) — decodes/rebuilds `classes.dex` from smali
- **Android build-tools** (`zipalign`, `apksigner`, `aapt`). Point the build at them:
  `export ANDROID_BUILD_TOOLS=/path/to/Android/sdk/build-tools/35.0.0`
- **Node.js 18+** and **frida-compile 17** (bundles the agent):
  `cd agent && npm install` (installs `frida-java-bridge` and `frida-compile` from `agent/package.json`).
  Put `frida-compile` on PATH, e.g. `export PATH="$PWD/agent/node_modules/.bin:$PATH"`.

## 3. Create your signing key (once)

```bash
mkdir -p signing
keytool -genkeypair -v -keystore signing/wzm_offline_test_signing.p12 -storetype PKCS12 \
  -keyalg RSA -keysize 2048 -validity 10000 -alias wzm-offline-test \
  -dname "CN=WZM Offline" -storepass "CHOOSE_A_PASSWORD" -keypass "CHOOSE_A_PASSWORD"
export WZM_OFFLINE_KEY_PASSWORD="CHOOSE_A_PASSWORD"
```

The alias **must** be `wzm-offline-test` (the build passes it to apksigner). The game doesn't care which key you use,
only that all five splits use the **same** key every time (`signature_spoof.js` handles the publisher-certificate check
at runtime). Keep this key: updating a phone needs the same key or Android refuses the update.

## 4. Build (one step)

```bash
export WZM_OFFLINE_KEY_PASSWORD="CHOOSE_A_PASSWORD"
export ANDROID_BUILD_TOOLS=/path/to/Android/sdk/build-tools/35.0.0
export PATH="$PWD/agent/node_modules/.bin:$PATH"

python3 build/build_all.py \
  --original  /path/to/original_5_splits \
  --gadget    /path/to/frida-gadget-17.x-android-arm64.so \
  --keystore  signing/wzm_offline_test_signing.p12 \
  --output    out/signed_splits
```

`build/build_all.py` does, in order:
1. compiles `agent/entry.js` → `libgadget.script.so` (frida-compile);
2. patches `base.apk`: replaces the bootstrap start page, disables the "offline" box in `offline.js`, patches
   `classes.dex` (25 s deferred `loadLibrary("gadget")`, main process only) via apktool, patches the manifest;
3. adds the three Gadget libraries to the arm64 split;
4. re-signs all five splits with your key, writes `SHA256SUMS.txt`.

Output is `out/signed_splits/` with the five APKs. Install per docs/03.

## 5. Agent-only rebuild (fast, during development)

After the first full build you usually only change the agent. Recompile and swap just the arm64 split:

```bash
cd agent && frida-compile entry.js -B iife -S -o /tmp/libgadget.script.so
# then rebuild only split_config.arm64_v8a.apk by replacing lib/arm64-v8a/libgadget.script.so and re-signing,
# or, with root on the phone, hot-update without any rebuild (docs/06, push_override.sh).
```

The historical build chain (`build.py`, `build_boot_control.py`, `build_delayed.py`, `build_r7.py`,
`build_base_offline_page.py`) is kept for reference; `build_all.py` folds their proven steps into one. `build_r7.py`
is the exact "swap only the arm64 split's agent" step used for every release after the first.

## 6. The manifest edit (`axml_patch.py`)

Android binary XML. It sets `android:extractNativeLibs="true"` (so the compressed Gadget `.so` files are unpacked at
install) and adds one signature-level permission. Everything else stays byte-identical.

## 7. Verifying a build

- `apksigner verify --print-certs out/signed_splits/*.apk` — all five show the **same** signer.
- `aapt dump badging out/signed_splits/base.apk` — `versionCode='3953' versionName='4.5.2.22729281'`.
- The arm64 split still contains the original `libgame.so` (sha256 `c8f5e9df…7d7`).
- `unzip -l out/signed_splits/split_config.arm64_v8a.apk | grep libgadget` — three libgadget files present.
