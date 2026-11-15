#!/bin/zsh
# Fresh boot with the local bootstrap page, then keep the fence skip installed.
# Give native startup a long instrumentation-free grace window. Readiness is then
# observed with one bounded attachment instead of repeated Frida attach/detach cycles.
# Screenshot size is unreliable under overlays.
#
# RETRY LIMIT: retries force-stop the app and can turn a slow boot into a kill loop.
# Default is one attempt. A failed readiness probe leaves the app/device alone.
# usage: boot_offline.sh <watch seconds> <screenshot dir>
D=PHONE_IP:5555; P=com.activision.callofduty.warzone
cd "${0:A:h}"
TRIES=${WZM_BOOT_TRIES:-1}
for try in $(seq 1 $TRIES); do
 if [[ ${WZM_BOOT_FORCE_STOP:-1} == 1 ]]; then
  adb -s $D shell "su -c 'am force-stop $P'" || exit 1
 fi
 # WZM_MBLUR=1: frame-blending motion blur must attach before the swapchain exists; one runner covers all tries
 if [[ ${WZM_MBLUR:-0} == 1 && -z ${MBVK_RUNNER:-} ]]; then
  ../../frida_venv/bin/python3 mbvk_run.py 7200 >> ../../runtime/mbvk_last.log 2>&1 &
  MBVK_RUNNER=$!; sleep 1
 fi
 START=$(adb -s $D shell "su -c 'am start -W -n $P/com.activision.game.MainActivity'" 2>&1)
 print -r -- "$START" | tail -6
 sleep ${WZM_BOOT_WAIT:-60}
 if ../../frida_venv/bin/python3 boot_ready.py ${WZM_BOOT_PROBE_WAIT:-60}; then
  print "booted on try $try"
  exec ../../frida_venv/bin/python3 watch.py $1 "$2" </dev/null
 fi
 if [[ $try -lt $TRIES ]]; then
  print "stalled at logo on try $try/$TRIES; restarting now"
  continue
 fi
 print "menu callback not observed on try $try/$TRIES; giving up"
 exit 1
done
exit 1
