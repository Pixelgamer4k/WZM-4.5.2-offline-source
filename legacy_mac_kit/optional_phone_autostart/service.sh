#!/system/bin/sh
# KernelSU/Magisk late-start service: bring up frida-server, then auto-inject the
# offline fence script into Warzone Mobile whenever it starts.
# Nothing here touches libgame.so, the split APKs, or the anti-tamper VM.

MODDIR=${0%/*}
LOG=/data/local/tmp/wzm_offline.log
PKG=com.activision.callofduty.warzone
MARK=/data/local/tmp/wzm_offline
FIRST_ATTACH_DELAY=20   # attaching inside the first ~15s causes the logo stall

mkdir -p "$MARK"

until [ "$(getprop sys.boot_completed)" = "1" ]; do sleep 2; done
echo "--- wzm_offline service start $(date) ---" >> "$LOG"

# 1. frida-server on loopback (the phone's own copy, already in /data/local/tmp)
if ! pidof wzm_frida_server >/dev/null 2>&1; then
    /data/local/tmp/wzm_frida_server -l 127.0.0.1:27042 >> "$LOG" 2>&1 &
    sleep 2
    echo "frida-server started pid=$(pidof wzm_frida_server)" >> "$LOG"
else
    echo "frida-server already running" >> "$LOG"
fi

# 2. inject once per game process
while true; do
    PID=$(pidof "$PKG")
    if [ -n "$PID" ] && [ ! -f "$MARK/injected_$PID" ]; then
        sleep "$FIRST_ATTACH_DELAY"
        PID2=$(pidof "$PKG")
        # process must still be the same one we saw, and still alive
        if [ -n "$PID2" ] && [ "$PID2" = "$PID" ] && [ ! -f "$MARK/injected_$PID" ]; then
            : > "$MARK/injected_$PID"
            chmod 755 "$MODDIR/bin/frida-inject"
            echo "injecting into $PID at $(date)" >> "$LOG"
            "$MODDIR/bin/frida-inject" -p "$PID" -s "$MODDIR/auto_fences.js" >> "$LOG" 2>&1 &
            sleep 8
        fi
    fi
    # drop markers for dead processes so a relaunch re-injects
    for f in "$MARK"/injected_*; do
        [ -e "$f" ] || continue
        P=${f##*/injected_}
        [ -d "/proc/$P" ] || rm -f "$f"
    done
    sleep 3
done
