#!/usr/bin/env python3
"""trace_index.py <zoneNN.bin> <decoded.bin> <out.json>
Turns a device loader trace into an exact asset index of a decoded WZM 4.5.2 zone:
for each asset: type id/name, [start,end) byte range in the decoded stream, read count; header/string-table ranges;
per type: root loader call site and read-size signature of the first instance."""
import json,struct,sys,collections,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
names={t['id']:t['name'] for t in json.load(open(HERE.parent/'map_import_20261104/xasset_type_name_mapping_20261104.json'))['observed_tables']['current_452']['asset_types']}
tr=Path(sys.argv[1]).read_bytes();dec=Path(sys.argv[2]).read_bytes()
pos=0;assets=[];cur=None;pre=[]
for i in range(len(tr)//16):
    k,a,b,c=struct.unpack_from('<4I',tr,i*16)
    if k==2:
        if cur:cur['end']=pos
        cur={'i':b,'type':a,'name':names.get(a,'?'),'start':pos,'reads':0,'sig':[]};assets.append(cur)
    elif k==1:
        if cur is None:pre.append([pos,c,hex(a)])
        else:
            cur['reads']+=1
            if len(cur['sig'])<40:cur['sig'].append([hex(a),c])
        pos+=c
    elif k==3 and cur is not None:
        cur.setdefault('inserts',0);cur['inserts']+=1
if cur:cur['end']=pos
assert pos==len(dec),('trace bytes',pos,'!= decoded',len(dec))
types=collections.OrderedDict()
for a in assets:
    t=types.setdefault(a['name'],{'id':a['type'],'count':0,'bytes':0,'first':a['i'],'root_site':a['sig'][0][0] if a['sig'] else None,'sig':a['sig'][:12]})
    t['count']+=1;t['bytes']+=a['end']-a['start']
out={'decoded_sha256':hashlib.sha256(dec).hexdigest(),'decoded_bytes':len(dec),'prefix_reads':pre,
     'asset_count':len(assets),'types':types,
     'assets':[{k:v for k,v in a.items() if k!='sig'} for a in assets]}
Path(sys.argv[3]).write_text(json.dumps(out))
print('assets',len(assets),'types',len(types),'prefix bytes',assets[0]['start'] if assets else pos)
for n,t in sorted(types.items(),key=lambda x:-x[1]['bytes'])[:25]:print(f"{n:28s} id{t['id']:4d} n={t['count']:5d} bytes={t['bytes']:10d} root={t['root_site']}")
