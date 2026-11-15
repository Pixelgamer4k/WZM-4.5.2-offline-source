#!/bin/zsh
# shots_after_enter.sh <outdir> <n> <interval>: after the newest run log logs clientEnterWorld, take n screenshots.
D=${0:A:h}/../../runtime/match_entry_20261102; O=$1; mkdir -p $O; old=$(ls -t $D/t*.log | head -1)
until L=$(ls -t $D/t*.log | head -1); [ "$L" != "$old" ] && grep -q clientEnterWorld $L 2>/dev/null; do sleep 1; done
for i in $(seq 1 $2); do sleep $3; adb -s PHONE_IP:5555 exec-out screencap -p > $O/s_$i.png; done
