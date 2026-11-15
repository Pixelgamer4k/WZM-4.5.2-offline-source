/* Read-only verification of new host-embedded fixed-720 controller.
   Samples original/native render target sizing and GPU renderpass dimensions
   for 15 seconds; never writes memory or hooks return values. */
'use strict';
const m=Process.getModuleByName('libgame.so'), b=m.base;
const t0=Date.now(), total={},perSecond={},sourceIndex={},sizing={},sizes={},errors=[];
function incr(d,k){d[k]=(d[k]||0)+1;}
const rp=b.add(0xadfa370).readPointer();
const hr=Interceptor.attach(rp,{onEnter(args){
 try{
  const q=args[1],w=q.add(0x28).readU32(),h=q.add(0x2c).readU32();
  if(w>=480 && h>=480 && w<2600 && h<1800){
   const k=w+'x'+h;incr(sizes,k);
   const sec=String(Math.floor((Date.now()-t0)/1000));
   incr(perSecond[sec]||(perSecond[sec]={}),k);
  }
 }catch(e){if(errors.length<5)errors.push(String(e));}
}});
const hs=Interceptor.attach(b.add(0x2eaf78c),{
 onEnter(args){
  this.out=this.context.x8;
  this.input=[args[0].toInt32(),args[1].toInt32()];
  this.level=args[6].toInt32();
  this.descriptor=0;
  try{this.descriptor=args[5].add(0x1c).readU32();}catch(e){}
  incr(sourceIndex,String(this.level));
 },
 onLeave(){
  try{
   const o=this.out,wh=o.add(8).readU32()+'x'+o.add(12).readU32();
   incr(sizing,wh);incr(total,'descriptor_'+this.descriptor);
  }catch(e){if(errors.length<5)errors.push(String(e));}
 }
});
setTimeout(()=>{
 hr.detach();hs.detach();
 const k=(o)=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
 send({event:'fixed720Verification',elapsedMs:Date.now()-t0,renderPasses:k(sizes).slice(0,20),nativeOutput:k(sizing).slice(0,15),selectorRead:k(sourceIndex),descriptor:k(total),secondBins:perSecond,errors});
},15000);
