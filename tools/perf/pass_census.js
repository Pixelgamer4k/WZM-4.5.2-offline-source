// Read-only: every vkCmdBeginRenderPass for N seconds: size, game call site, clear count.
const m=Process.getModuleByName('libgame.so'),b=m.base;
const rp=b.add(0xadfa370).readPointer();
rpc.exports={run(secs){const C={};let tot=0;
 const h=Interceptor.attach(rp,{onEnter(a){try{const i=a[1];if(i.isNull())return;
  const w=i.add(0x28).readU32(),hh=i.add(0x2c).readU32(),x=i.add(0x20).readS32(),y=i.add(0x24).readS32(),nc=i.add(0x30).readU32();
  const lr=this.returnAddress;const site=(lr.compare(b)>=0&&lr.compare(b.add(m.size))<0)?'g+'+lr.sub(b).toString(16):'x';
  const k=w+'x'+hh+(x||y?('@'+x+','+y):'')+' clr'+nc+' '+site;C[k]=(C[k]||0)+1;tot++;}catch(e){}}});
 Thread.sleep(secs);h.detach();return {tot,C};}};
