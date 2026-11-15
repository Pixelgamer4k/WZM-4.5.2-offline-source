#!/usr/bin/env python3
"""Supervise this project's Mac launchers without leaving orphan boot/watch processes.

Requires only Python 3's standard library. Never force-stops Android, kills adb/frida
servers, touches game data, or changes the original project launch scripts.
"""
from __future__ import annotations

import json
import os
import pathlib
import shlex
import signal
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
STATE = ROOT / "analysis/runtime/user_tools/current_session.json"

# Exact basenames of this project's Mac-side game controllers, not service daemons.
# In ps(1) these occur as the first script argument to zsh/Python.
GAME_SCRIPTS = {
    "play_mp.sh", "play_sd.sh", "play_crash2_both.sh", "play_crash2_bots.sh",
    "play_with_bots.sh", "play_with_native_ai.sh", "play_offline.sh",
    "play_one_bot_mingfx.sh", "play_observer_occupant.sh",
    "run_host.sh", "host_from_live_menu.sh", "boot_offline.sh",
    "menu_return_watch.py", "both_sides_bots.py", "bot_ready_watch.py",
    "host_spawn.py", "boot_ready.py", "watch.py", "java_watch.py",
    "mbvk_run.py", "mbvk_attach.py", "menu_rematch_bots.py",
    "fake_player_data.py", "frontend_weapon_catalog.py",
    "restore_hub_binary.py", "lua_exec.py", "unlock_all_menu.sh",
    "prepare_loadout_frontend.sh", "play_offline_with_bots.sh",
}


def processes():
    """(pid, ppid, pgid, stat, command), from macOS ps, without privileges."""
    out = subprocess.check_output(
        ["ps", "-axo", "pid=,ppid=,pgid=,stat=,command="], text=True
    )
    result = []
    for line in out.splitlines():
        parts = line.strip().split(None, 4)
        if len(parts) < 5:
            continue
        try:
            pid, ppid, pgid = (int(s) for s in parts[:3])
        except ValueError:
            continue
        if parts[3].startswith("Z"):
            continue
        result.append((pid, ppid, pgid, parts[3], parts[4]))
    return result


def is_game_controller(command):
    try:
        words = shlex.split(command)
    except ValueError:
        return False
    if len(words) < 2:
        return False
    executable = pathlib.Path(words[0]).name.lower()
    if executable in ("zsh", "bash", "sh", "dash", "ksh"):
        # `zsh -lc '...'` is an interactive/tool shell, never a controller.
        script = words[1]
        if script.startswith("-"):
            return False
    elif executable.startswith("python"):
        # `python -c '...'` and runtime helpers must never match a script name.
        scripts = [word for word in words[1:4] if not word.startswith("-")]
        if not scripts or "-c" in words[1:4] or "-m" in words[1:4]:
            return False
        script = scripts[0]
    else:
        return False
    return pathlib.Path(script).name in GAME_SCRIPTS


def is_group_helper(command):
    """Harmless shell pipeline children, ONLY for an otherwise game-only group."""
    try:
        words = shlex.split(command)
    except ValueError:
        return False
    if not words:
        return False
    exe = pathlib.Path(words[0]).name
    if exe in ("tee", "tail", "cut", "sleep", "grep", "head"):
        return True
    return exe == "adb" and "logcat" in words


def game_processes(rows=None):
    rows = processes() if rows is None else rows
    return [r for r in rows if r[0] != os.getpid() and is_game_controller(r[4])]


def load_state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return None


def save_state(data):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_name(f"current_session.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(STATE)


def delete_state_if_same(token):
    state = load_state()
    if state and state.get("token") == token:
        STATE.unlink(missing_ok=True)


def live_group(pgid, rows=None):
    rows = processes() if rows is None else rows
    return [r for r in rows if r[2] == pgid]


def terminate_group(pgid, *, seconds=2.5):
    if pgid <= 1 or pgid == os.getpgrp():
        print(f"Refusing unsafe process group {pgid}", flush=True)
        return
    try:
        os.killpg(pgid, signal.SIGTERM)
    except ProcessLookupError:
        return
    except PermissionError as exc:
        print(f"Unable to stop group {pgid}: {exc}", flush=True)
        return
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if not live_group(pgid):
            return
        time.sleep(0.1)
    if live_group(pgid):
        try:
            os.killpg(pgid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


def belongs_to_this_source(pid):
    """Only adopt orphan controllers whose CWD is inside THIS extracted folder.

    macOS lsof returns the OS-resolved CWD, even when a shell uses a relative
    script path. A permission/lookup failure is a refusal, not an assumption.
    """
    try:
        proc = subprocess.run(
            ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
            capture_output=True, text=True, timeout=4, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    for line in proc.stdout.splitlines():
        if not line.startswith("n"):
            continue
        try:
            pathlib.Path(line[1:]).resolve().relative_to(ROOT)
            return True
        except ValueError:
            pass
    return False


def stop_legacy():
    rows = processes()
    targets = [r for r in game_processes(rows) if belongs_to_this_source(r[0])]
    grouped = {}
    for row in targets:
        grouped.setdefault(row[2], []).append(row)
    if not grouped:
        print("No leftover controllers from this portable folder found.", flush=True)
        return
    for pgid, matched in sorted(grouped.items()):
        members = [r for r in rows if r[2] == pgid]
        # Only signal the WHOLE PGID when every member is a project controller
        # or its known pipeline helper. Never kill another Terminal shell.
        safe_group = (
            pgid > 1 and pgid != os.getpgrp()
            and all(is_game_controller(r[4]) or is_group_helper(r[4]) for r in members)
        )
        if safe_group:
            print(f"Stopping orphan project group {pgid}: {len(members)} processes", flush=True)
            terminate_group(pgid)
            continue
        # Fallback: stop ONLY specifically identified scripts and descendants.
        # Avoid killing any unrelated process that shares the Terminal's PGID.
        known = {r[0] for r in matched}
        changed = True
        while changed:
            old = len(known)
            known.update(r[0] for r in rows if r[1] in known)
            changed = len(known) != old
        known.discard(os.getpid())
        print(f"Stopping {len(known)} project processes individually in mixed group {pgid}", flush=True)
        for pid in sorted(known, reverse=True):
            try:
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
    time.sleep(0.3)
    rest = [r for r in game_processes() if belongs_to_this_source(r[0])]
    if rest:
        print(f"WARNING: {len(rest)} portable controllers remain; inspect using `status`.", flush=True)
    else:
        print("Mac game controllers stopped; Android app/data and adb/frida servers untouched.", flush=True)


def show_status():
    state = load_state()
    if state:
        pgid = state.get("pgid", -1)
        print(f"Managed session: group {pgid}, mode {state.get('mode')}, running={bool(live_group(pgid))}")
    else:
        print("Managed session: none")
    all_active = game_processes()
    active = [r for r in all_active if belongs_to_this_source(r[0])]
    if not active:
        print("Portable source game-launch watchers/controllers: none")
    else:
        for pid, ppid, pgid, stat, cmd in active:
            print(f"{pid:>6} PGID={pgid:<7} PPID={ppid:<7} {cmd[:200]}")
    if len(all_active) != len(active):
        print("Other workspace game controller(s) detected (not managed or stopped by this source).")


def run(argv, mode):
    if not argv:
        print("Missing launcher command", file=sys.stderr)
        return 2
    state = load_state()
    if state and live_group(state.get("pgid", -1)):
        print("Existing managed game session is still active. Run `stop` first.", file=sys.stderr)
        return 1
    if game_processes():
        print("An older game launcher/watcher is running. Run `stop` first to avoid boot loops.", file=sys.stderr)
        show_status()
        return 1
    def interrupt(sig, _frame):
        raise KeyboardInterrupt

    previous_sigint = signal.signal(signal.SIGINT, interrupt)
    previous_sigterm = signal.signal(signal.SIGTERM, interrupt)
    child = None
    token = None
    try:
        child = subprocess.Popen(argv, start_new_session=True)
        token = str(time.time_ns())
        save_state({"pid": child.pid, "pgid": child.pid, "mode": mode,
                    "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "command": argv, "token": token})
        print(f"Managed game controller group {child.pid}. Ctrl+C stops all child watchers.", flush=True)
        result = child.wait()
        return 128 - result if result < 0 else result
    except KeyboardInterrupt:
        print("Stopping game controllers and all background watchers...", flush=True)
        return 130
    finally:
        # Ignore repeated interrupts until the cleanup completes.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        # Even a normal launcher exit can leave `nohup`/`&` workers behind.
        if child is not None:
            terminate_group(child.pid)
        if token is not None:
            delete_state_if_same(token)
        signal.signal(signal.SIGINT, previous_sigint)
        signal.signal(signal.SIGTERM, previous_sigterm)


def main(argv):
    action = argv[0] if argv else "status"
    if action == "status":
        show_status()
        return 0
    if action == "stop":
        state = load_state()
        if state:
            pgid = state.get("pgid", -1)
            if pgid > 1 and live_group(pgid):
                # Confirm this group still belongs to a known launcher, not a recycled PID.
                if any(is_game_controller(r[4]) and belongs_to_this_source(r[0]) for r in live_group(pgid)):
                    print(f"Stopping managed game session group {pgid}", flush=True)
                    terminate_group(pgid)
        # Portable edition cleans only workspace-owned orphan controllers.
        # It NEVER stops processes merely because another project uses the same
        # script filenames. The original development workspace stays untouched.
        stop_legacy()
        return 0
    if action == "run":
        args = argv[1:]
        if args and args[0] == "--":
            args = args[1:]
        return run(args, " ".join(args[:3]))
    print("Usage: session_manager.py [status|stop|run -- COMMAND ...]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
