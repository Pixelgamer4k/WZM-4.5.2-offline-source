#!/usr/bin/env python3
"""summarize_host.py <host log>: one screen of what a host run reached."""
import collections,json,sys
KEY=['dnsLookup','dnsHookFailed','modeRequestSeen','modeApplySeen','gametypeCacheCleared','gametypeSet','omnvarAdded','omnvarAddFailed','uiMissingExists','omnvarBuild','uiMissingPushed','uiMissingNil','uiLookupMissing','DEV','devError','modeSwitch','modeSwitched','modeSwitchFailed','luaCacheBuilt','luaCacheFailed','luaCacheServed','uiAssetPoll','uiAssetPollFailed','uiRetryArmed','uiRestartEnter','uiRestartReturned','feature77','zoneListCaller','modeTable','modeSwitch','modeSwitched','modeSwitchFailed','hostStart','hostStartReturned','err','levelRequest',
     'levelState','zoneQueued','strtRespAccepted','clientEnterWorld','svDropHeld','luaError','FATAL','playerDataPrepared']
count=collections.Counter();shown=collections.Counter();last=None
for line in open(sys.argv[1]):
    try:e=json.loads(line)
    except ValueError:continue
    s=e.get('s')
    if s=='state':last=e
    if s not in KEY:continue
    count[s]+=1;shown[s]+=1
    if shown[s]<=(12 if s in('zoneQueued','levelState') else 3):
        e.pop('captureEpochMs',None);print(json.dumps(e)[:600])
print('counts',dict(count))
if last:
    last.pop('captureEpochMs',None);print('last state',json.dumps(last)[:400])
print('reached world' if count['clientEnterWorld'] else 'did NOT reach world','| level request seen' if count['levelRequest'] else '| no level request')
