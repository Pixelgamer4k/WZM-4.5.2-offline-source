import json,struct,sys
em=json.load(open(sys.argv[1]))['reads']
tr=open(sys.argv[2],'rb').read();dv=[]
for i in range(len(tr)//16):
    k,a,b,c=struct.unpack_from('<4I',tr,i*16)
    if k==1:dv.append((c,a,b))
for i,(e,d) in enumerate(zip(em,dv)):
    if e[1]!=d[0]:
        print('diverge at read',i,'emu',e[1],hex(e[2]),'dev',d[0],hex(d[1]),hex(d[2]));print('dev ctx',[(x[0],hex(x[1]),hex(x[2])) for x in dv[i-4:i+3]]);print('emu ctx',[(x[1],hex(x[2])) for x in em[i-4:i+3]]);break
else: print('no divergence in',min(len(em),len(dv)),'emu',len(em),'dev',len(dv))
