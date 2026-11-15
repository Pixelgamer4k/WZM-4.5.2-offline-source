// Read-only dynamic render target distinction, by native caller + dimensions.
'use strict';
const m=Process.getModuleByName('libgame.so'),b=m.base;
const rp=b.add(0xadfa370).readPointer();
let counts={},bins={},total=0;const start=Date.now();
const h=Interceptor.attach(rp,{onEnter(args){
 try {
  const i=args[1];if(i.isNull())return;
  const w=i.add(0x28).readU32(),h=i.add(0x2c).readU32();
  if(w<480||h<480||w>2500||h>1500)return;
  const loc=this.returnAddress;
  const c=(loc.compare(b)>=0&&loc.compare(b.add(m.size))<0)?'game+'+loc.sub(b).toString(16):'other+'+loc.toString();
  const k=w+'x'+h+'@'+c;
  counts[k]=(counts[k]||0)+1;
  const t=Math.floor((Date.now()-start)/1000);
  const bin=bins[t]||(bins[t]={});
  const wh=w+'x'+h;
  bin[wh]=(bin[wh]||0)+1;
  total++;
 }catch(e){}
}});
setTimeout(()=>{h.detach();send({event:'renderpassSizesAndCallsites',total,top:Object.entries(counts).sort((a,c)=>c[1]-a[1]).slice(0,40),bySecond:bins});},5500);
