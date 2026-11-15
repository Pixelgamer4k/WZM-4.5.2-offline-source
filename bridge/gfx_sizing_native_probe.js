// Read-only inspection of original 0x2eaf78c render-size configuration builder.
'use strict';
const m=Process.getModuleByName('libgame.so'),p=m.base.add(0x2eaf78c),stats={},ex=[],errors=[];let count=0;
const hook=Interceptor.attach(p,{
 onEnter(args){
  this.output=this.context.x8;
  this.input=[args[0].toInt32(),args[1].toInt32(),args[2].toInt32(),args[3].toInt32(),args[4].toInt32(),args[6].toInt32(),args[7].toInt32()];
  try{this.descriptor=args[5].readByteArray(40);this.desc=Array.from(new Uint8Array(this.descriptor)).slice(0,32).map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){this.desc='?'}
  this.caller='0x'+this.returnAddress.sub(m.base).toString(16);
 },
 onLeave(){
  count++;
  try{
   const d=this.output;
   const widths=[d.readU32(),d.add(4).readU32(),d.add(8).readU32(),d.add(12).readU32(),d.add(16).readU32(),d.add(20).readU32()];
   const key='in='+this.input+';out='+widths+';desc='+this.desc+';caller='+this.caller;
   stats[key]=(stats[key]||0)+1;
  }catch(e){if(errors.length<5)errors.push(String(e));}
 }
});
setTimeout(()=>{hook.detach();send({event:'nativeSizing',count,top:Object.entries(stats).sort((a,b)=>b[1]-a[1]).slice(0,25),errors});},5500);
