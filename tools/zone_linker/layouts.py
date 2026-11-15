#!/usr/bin/env python3
import os
"""layouts.py <emu.graph.pkl> <index.json> <out.json> type...: full layout per asset type =
graph tree (field offset -> child block size/site) + static count expression per read site."""
import pickle,json,sys,bisect,subprocess,re
from pathlib import Path
import schema_extract as SE
G=pickle.load(open(sys.argv[1],'rb'));ix=json.load(open(sys.argv[2]));out=Path(sys.argv[3]);types=sys.argv[4:]
reads=G['reads'];assets=G['assets']+[(len(reads),-1)]
dis=open(os.environ.get('WZM_LIBGAME_DIS', 'libgame.dis')).read().splitlines()
starts_fn=[]
for l in dis:
    m=re.match(r'\s*([0-9a-f]+):\s+(stp\s+x29, x30, \[sp, #-|sub\s+sp, sp, #)',l)
    if m:starts_fn.append(int(m.group(1),16))
starts_fn.sort()
def fn_of(site):i=bisect.bisect_right(starts_fn,site-4)-1;return starts_fn[i]
cache={}
def static_for(site):
    f=fn_of(site)
    if f not in cache:
        try:cache[f]={e[3]:(e[1],e[2]) for e in SE.analyze(f)[1] if e[0]=='READ' and len(e)>3}
        except Exception as ex:cache[f]={}
    return cache[f].get(hex(site))
res={}
for want in types:
    ai=[i for i,a in enumerate(ix['assets']) if a['name']==want][0];r0,r1=assets[ai][0],assets[ai+1][0]
    blocks=reads[r0:r1];st=sorted((b[3],k) for k,b in enumerate(blocks));sa=[s for s,_ in st]
    bydst={}
    for k,b in enumerate(blocks):bydst.setdefault(b[3],k)
    def owner(a):
        i=bisect.bisect_right(sa,a)-1
        if i<0:return None
        k=st[i][1];b=blocks[k];return (k,a-b[3]) if a<b[3]+max(b[1],1) else None
    edges=[]
    for a,v,ri in G['ptrs']:
        if r0<=ri<=r1:
            o=owner(a);t=bydst.get(v)
            if o and t is not None and t!=o[0]:edges.append((o[0],o[1],t))
    nodes=[{'k':k,'site':hex(b[2]),'size':b[1],'static':static_for(b[2])} for k,b in enumerate(blocks)]
    res[want]={'asset_index':ai,'blocks':len(blocks),'nodes':nodes[:4000],'edges':edges[:20000]}
    print(want,'blocks',len(blocks),'edges',len(edges),'static hits',sum(1 for n in nodes if n['static']))
out.write_text(json.dumps(res))
