import json,re,sys
last=[]
for l in open(sys.argv[1]):
    if l.startswith('{"type"'):
        try:p=json.loads(l).get('payload',{})
        except:
            if '"fatal"' in l:print('FATAL',l[:240].replace('\\ufffd','|'))
            continue
        if 'step' in p:last.append(p['step'])
        elif 'trip' in p:print('TRIP',p['trip'],p['bt'])
        elif 'sessionError' in p:print('SESSIONERR',p['sessionError'],p['hash'],p['bt'])
        elif 'net' in p:print('NET',p.get('fn'),p.get('to') or p.get('host'),p['from'])
        elif 'fault' in p:print('FAULT',p['fault'],p['type'],p.get('bt',[])[:6])
        elif 'fatal' in p:print('FATAL',p['fatal'],(p.get('arg') or '')[:40].split('�')[0],p['lr'],p.get('bt',[])[:6])
        elif 'fatalMsg' in p and 'ERROR' in (p['fatalMsg'] or ''):print('MSG',p['fatalMsg'].split('�')[0][:90])
print('steps',last[-16:])
t=''.join(x for x in open(sys.argv[1]) if not x.startswith('{"type"'))
m=re.search(r'\{\s*"counts".*',t,re.S)
if m:
    try:
        r=json.loads(m.group(0));print({k:v for k,v in r['counts'].items() if not k.startswith('login')});print([x for x in r['log'] if x['k'] in('levelRequest','armed')]);print('party',r['party'],'zones',r['zones'])
    except Exception as e:print('no final snapshot',e)
