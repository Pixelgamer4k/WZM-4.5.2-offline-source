import struct,sys,hashlib,os
src,out=sys.argv[1],sys.argv[2];d=open(src,'rb').read();os.makedirs(out,exist_ok=True)
i=0;n=0;seen=set();stats=[]
while True:
    i=d.find(b'\x03\x02\x23\x07',i)
    if i<0:break
    pass
    p=i+20;ok=True
    while p+4<=len(d):
        w=struct.unpack_from('<I',d,p)[0];wc=w>>16;op=w&0xffff
        if wc==0 or op>6000 or op==0:break
        p+=wc*4
    blob=d[i:p];h=hashlib.sha1(blob).hexdigest()[:12]
    if len(blob)>100 and h not in seen:
        seen.add(h);open(f'{out}/{h}.spv','wb').write(blob);n+=1
        # entry point model
        q=i+20;model=None
        while q<p:
            w=struct.unpack_from('<I',d,q)[0];wc=w>>16;op=w&0xffff
            if op==15:model=struct.unpack_from('<I',d,q+4)[0];break
            q+=wc*4
        stats.append(model)
    i=p if p>i else i+4
import collections;print('modules',n,'models',collections.Counter(stats))
