==========================================================================================
  WZM OFFLINE  —  beta v1.0  (app build r19)
  Call of Duty: Warzone Mobile 4.5.2 (versionCode 3953), playable offline
  For arm64 Android phones only.  Written 12 Nov 2026.
==========================================================================================

READ THIS WHOLE FILE ONCE BEFORE YOU START.
There are TWO parts and you need BOTH:

  PART A  = install the app (the APK files in this folder)
  PART B  = put the game data (files.zip, about 13 GB) into the game's data folder

The app alone is not enough: the maps, guns, sounds and textures live in the data
folder, not inside the APK. Without Part B the game will not start properly.

Order on a new phone:   A (install)  ->  B (data)  ->  first launch.
Do NOT open the game between A and B.


------------------------------------------------------------------------------------------
WHAT IS IN THIS FOLDER
------------------------------------------------------------------------------------------
  WZM_Offline_beta_v1.0.apks         all five APK parts in one file (easiest to install)
  WZM_Offline_beta_v1.0.apks.sha256  checksum of the .apks file
  splits/                            the same five APK parts as separate files:
      base.apk
      split_config.arm64_v8a.apk     (game code + the offline mod, build r19)
      split_config.en.apk
      split_config.xxxhdpi.apk
      split_asset_pack.apk           (1.8 GB)
      SHA256SUMS.txt                 checksums of the five files
  WZM_Offline_Guide_beta_v1.0.pdf    how to play (ball menu, Gear Up, settings, known issues)
  INSTALL.txt                        this file

Not in this folder (keep it safe separately!):
  files.zip                          your saved copy of the game data (~13 GB)


------------------------------------------------------------------------------------------
APPS YOU NEED ON THE PHONE (all free)
------------------------------------------------------------------------------------------
  1. SAI  ("Split APKs Installer")     — installs the .apks file.      Play Store or F-Droid.
  2. Shizuku  (by RikkaApps)           — gives ZArchiver permission to open Android/data
                                          on phones WITHOUT root.       Play Store or GitHub.
  3. ZArchiver  (by ZDevs)             — file manager that unzips files.zip into Android/data.
                                          Play Store.

Why Shizuku: since Android 11, and strictly on Android 13 / 14 / 15 / 16, normal file
managers are NOT allowed to open  Android/data/<other app>.  Shizuku lets ZArchiver do it
without root. (On a rooted phone you can skip Shizuku and give ZArchiver root instead.)


==========================================================================================
PART A — INSTALL THE APP
==========================================================================================

A1. If the OFFICIAL Warzone Mobile from the Play Store is installed:
    - Android will refuse this build (different signature). You must uninstall the official one.
    - WARNING: uninstalling DELETES  Android/data/com.activision.callofduty.warzone  (~13 GB).
      If that folder has data you want, back it up first (or just use your files.zip in Part B).

A2. If an OLDER WZM Offline build (r16, r17, r18 ...) is installed:
    - Do NOT uninstall it. Simply install this one OVER it (SAI does an "update").
    - Your data folder and saved loadouts stay. You can then skip Part B.
    - (From r18 to r19 only split_config.arm64_v8a.apk changed.)

A3. Install with SAI (no computer):
    1. Copy  WZM_Offline_beta_v1.0.apks  to the phone (USB cable, Google Drive, etc.).
    2. Open SAI -> "Install APKs" -> choose the file -> Install.
       (Or choose all five files from splits/ together.)
    3. Wait until it says installed. DO NOT open the game yet if this is a new phone -> go to Part B.

A3 (alternative). Install from a computer with USB debugging:
    adb install-multiple -r splits/base.apk splits/split_config.arm64_v8a.apk splits/split_config.en.apk splits/split_config.xxxhdpi.apk splits/split_asset_pack.apk


==========================================================================================
PART B — RESTORE THE GAME DATA FROM files.zip
==========================================================================================

THE TARGET FOLDER (remember this path):

    Internal storage / Android / data / com.activision.callofduty.warzone / files

    full path:  /sdcard/Android/data/com.activision.callofduty.warzone/files

THE RULE:
    1) DELETE everything that is inside that "files" folder first,
    2) THEN put the contents of your files.zip in its place.
    Never mix old and new files.

Before you start:
    - Free space: you need about 13 GB for the unzipped data PLUS the size of files.zip
      while unzipping (~26 GB free in total). You can delete the zip afterwards only if you
      have another copy of it somewhere safe.
    - Charge the phone (unzipping 13 GB takes a while). Keep the screen on.
    - Make sure the game is CLOSED: Settings -> Apps -> COD Warzone -> Force stop.

---------------------------------------------------------------
B1. Set up Shizuku (one time; repeat "Start" after every reboot)
---------------------------------------------------------------
    1. Install Shizuku and open it.
    2. Turn on Developer options:
       Settings -> About phone -> tap "Build number" 7 times.
       (OnePlus/OxygenOS: Settings -> About device -> Version -> tap "Build number" 7 times.)
    3. Settings -> System -> Developer options -> turn ON "Wireless debugging"
       (the phone must be on any Wi-Fi network; internet is not needed).
    4. In Shizuku tap "Pairing" (under "Start via Wireless debugging").
       Shizuku shows a notification.
    5. Go back to Developer options -> Wireless debugging -> "Pair device with pairing code".
       A 6-digit code appears. Pull down the notification shade and type that code into
       Shizuku's notification -> send.
    6. Back in Shizuku tap "Start". It should now say "Shizuku is running".
    NOTE: After the phone restarts, Shizuku stops. Open it and tap "Start" again
          (pairing is NOT needed again; Wireless debugging must be ON).

---------------------------------------------------------------
B2. Give ZArchiver access to Android/data through Shizuku
---------------------------------------------------------------
    1. Open ZArchiver. Go to:  Internal storage -> Android -> data
    2. When ZArchiver says it has no access / asks how to access, choose  "Shizuku"
       and press "Allow" in the Shizuku permission popup.
       (If it does not ask: ZArchiver menu (three dots) -> Settings -> look for the
        Shizuku / "Android/data access" option and enable it, then open the folder again.)
    3. You should now see the folder  com.activision.callofduty.warzone.
       If the folder does not exist yet, open the game ONCE to the first screen, close it,
       Force stop it, and come back (the game creates the folder).

---------------------------------------------------------------
B3. Delete the old data
---------------------------------------------------------------
    1. In ZArchiver open:
       Android -> data -> com.activision.callofduty.warzone -> files
    2. Select EVERYTHING inside "files" (long-press one item -> "Select all").
    3. Delete. Wait until it finishes. The "files" folder must now be empty.
       (Delete only what is INSIDE "files" — keep the "files" folder itself.)

---------------------------------------------------------------
B4. Unzip files.zip into the "files" folder
---------------------------------------------------------------
    1. In ZArchiver find your files.zip (e.g. in Download). Tap it once and look inside
       before extracting:
         - If you see folders like  zone, xpak_cache, shard_cache ... directly at the top:
             choose "Extract..." and pick as target:
             Android/data/com.activision.callofduty.warzone/files
         - If the zip contains ONE folder named "files" with those folders inside it:
             choose "Extract..." and pick as target:
             Android/data/com.activision.callofduty.warzone
             (so it lands as .../warzone/files/...)
       The goal in both cases:  .../com.activision.callofduty.warzone/files/zone/...
       and NOT  .../files/files/zone/...
    2. Wait until the extraction is 100 % done. Do not leave ZArchiver or lock the phone
       for long while it runs.
    3. Check: open  .../com.activision.callofduty.warzone/files  -> you should see directly
       inside it things like:  zone, xpak_cache, shard_cache, shadercache, Library,
       cod24_data0.dcache, cod24_toc0.dcache, tos.db ... Long-press the "files" folder -> Properties:
       size should be about 13 GB.

---------------------------------------------------------------
B5. First launch
---------------------------------------------------------------
    1. Open COD Warzone from its icon.
    2. The first start can stop on the Activision logo — WAIT, it restarts itself
       (up to 4 times). The main menu appears after about 1 minute.
    3. About 20 seconds later the orange "WZ" ball appears on the left. Everything is unlocked.
       Tap the ball -> choose map/mode/bots -> PLAY.
    4. Read WZM_Offline_Guide_beta_v1.0.pdf for everything else.


==========================================================================================
VERY IMPORTANT — DO NOT FORGET
==========================================================================================
  - NEVER uninstall the game once it works. Uninstalling deletes the 13 GB data folder.
    New builds are always installed OVER the old one.
  - KEEP files.zip somewhere safe (PC, external drive, cloud). It is the only way to
    restore the game data on a new phone or after an accidental uninstall.
  - Your loadouts, operator/skin choice and ball-menu settings are stored inside the
    game's private storage on each phone. A new phone starts with defaults.
  - Internet and an Activision account are NOT needed to play.
  - Tested on OnePlus 12R (Android 16). On some phones (e.g. Redmi Note 10 Pro) the menu
    works but PLAY fails ("unable to intercept function"): open the ball -> Export Logs and
    send the log.


==========================================================================================
WHAT'S NEW
==========================================================================================
beta v1.0 (build r19)
  - 3D Gear Up: operator models, gun models (Weapon Select / customize / camo) and the 3D
    menu backdrop. Loads on the FIRST Gear Up tap of a session: status "Loading 3D Gear Up",
    the menu refreshes once and Gear Up opens by itself about 1 minute later. Don't tap
    during that minute.
  - PLAY from a fresh start is still instant. After Gear Up or a match, PLAY becomes
    "RESTART & PLAY" (the game restarts itself and starts your match).
  - Gear Up opened after a match is not 3D.
  - Fixed: RESTART & PLAY could return to the menu instead of starting the match.

build r18
  - Third-person camera: ball menu -> MATCH -> Camera (switch live during a match, remembered).
  - The ball fades to faint instead of disappearing: tap once to bring it back, tap again
    to open the menu.

build r17
  - Your equipped operator and skin (plus finishing move, taunt, intro) are saved and used
    in matches.
  - Fixed: Gear Up sometimes opened by itself after the menu reloaded.


==========================================================================================
QUICK CHECKLIST (new phone)
==========================================================================================
  [ ] Official Warzone uninstalled (if it was installed)
  [ ] SAI -> installed WZM_Offline_beta_v1.0.apks         (do not open the game yet)
  [ ] Shizuku running (Wireless debugging ON, paired, Start)
  [ ] ZArchiver -> Android/data opened through Shizuku
  [ ] Deleted everything inside  .../com.activision.callofduty.warzone/files
  [ ] Extracted files.zip so that  .../warzone/files/zone/...  exists (~13 GB)
  [ ] Opened the game, waited through the logo, orange WZ ball visible
