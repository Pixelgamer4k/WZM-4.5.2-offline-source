#!/bin/zsh
# tap_after_probe.sh <startmarker> <shotdir> <x> <y>: wait for this run's matchProbe line, tap twice, take screenshots.
R=../../runtime/match_entry_20261102; D=(adb -s PHONE_IP:5555)
L=""; for i in {1..2400}; do L=$(find $R -maxdepth 1 -name 't*.log' -newer $1 | head -1); [[ -n $L ]] && grep -aq '"matchProbe' $L && break; sleep 0.2; done
print "probe $(date +%T) $L"
sleep 0.3; $D shell input tap $3 $4; print "tap1 $(date +%T)"
sleep 0.4; $D shell input tap $3 $4; print "tap2 $(date +%T)"
for k in {1..15}; do $D exec-out screencap -p > $2/s_$k.png; print "shot$k $(date +%T)"; sleep 1; done
