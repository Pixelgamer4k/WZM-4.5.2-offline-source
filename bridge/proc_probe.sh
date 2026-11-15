#!/bin/zsh
# proc_probe.sh <samples> <interval>: read-only. Game RSS, and how many shard/xpak/zone files it has
# open or mapped, so a map zone load shows up as new open shards and a jump in memory.
A=(adb -s PHONE_IP:5555 shell su -c)
for i in {1..$1}; do
 P=$($A "pidof com.activision.callofduty.warzone" 2>/dev/null)
 if [[ -n $P ]]; then
  $A "printf '%s ' \$(date +%T) \$(grep VmRSS /proc/$P/status | tr -s ' ' | cut -d' ' -f2); \
   printf 'fd_shard=%s ' \$(ls -l /proc/$P/fd 2>/dev/null | grep -c shard_cache); \
   printf 'fd_xpak=%s ' \$(ls -l /proc/$P/fd 2>/dev/null | grep -c xpak_cache); \
   printf 'map_shard=%s ' \$(grep -c shard_cache /proc/$P/maps); \
   printf 'map_xpak=%s\n' \$(grep -c xpak_cache /proc/$P/maps)"
 else print "$(date +%T) no game"; fi
 sleep $2
done
