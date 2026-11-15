#!/usr/bin/env python3
"""layout_tree.py <emu.graph.pkl> <index.json> <type name> [instance#]
Prints the struct tree of one asset: blocks read (site,size), and which parent field (offset) points at each child."""
import pickle,json,sys,bisect,struct
G=pickle.load(open(sys.argv[1],'rb'));ix=json.load(open(sys.argv[2]))
want=sys.argv[3];inst=int(sys.argv[4]) if len(sys.argv)>4 else 0
reads=G['reads'];assets=G['assets']+[(len(reads),-1)]
idxs=[i for i,a in enumerate(ix['assets']) if a['name']==want]
ai=idxs[inst];r0,r1=assets[ai][0],assets[ai+1][0]
blocks=[r for r in reads[r0:r1]]           # (pos,size,site,dst)
starts=sorted((b[3],k) for k,b in enumerate(blocks))
sa=[s for s,_ in starts]
def owner(addr):
    i=bisect.bisect_right(sa,addr)-1
    if i<0:return None
    k=starts[i][1];b=blocks[k]
    return (k,addr-b[3]) if addr<b[3]+max(b[1],1) else None
bydst={}
for k,b in enumerate(blocks):bydst.setdefault(b[3],k)
edges={}
for addr,val,ri in G['ptrs']:
    if not(r0<=ri<=r1):continue
    o=owner(addr);t=bydst.get(val)
    if o and t is not None and t!=o[0]:edges.setdefault(o[0],[]).append((o[1],t))
seen=set()
def show(k,depth,maxd=4):
    b=blocks[k];print('  '*depth+f'[{k}] site={b[2]:#x} size={b[1]}')
    if k in seen or depth>=maxd:return
    seen.add(k)
    for off,t in sorted(edges.get(k,[]))[:40]:
        print('  '*depth+f'  +{off:#x} ->',end='');show(t,depth+1,maxd)
print(want,'asset',ai,'blocks',len(blocks),'edges',sum(len(v) for v in edges.values()))
show(0,0)
