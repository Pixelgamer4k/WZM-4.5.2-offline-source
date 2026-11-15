// One-shot telemetry of original ThirdPerson predicate; no writes, no replacements.
'use strict';
const m=Process.getModuleByName('libgame.so'), addr=m.base.add(0x1f6e840);
const counters={}, callers={}, ids={}; let calls=0,errors=0;
const h=Interceptor.attach(addr,{
 onEnter(args){
  if(calls>40000)return;
  this.ps=args[1].toString();this.caller=this.returnAddress.sub(m.base).toString();
 },
 onLeave(ret){
  if(calls++>40000)return;
  try{
   const id=this.ps||'?'; const c=this.caller||'?';
   const row=counters[id]||(counters[id]={count:0,true:0,false:0,callers:{}});
   row.count++;
   const val=ret.toInt32();if((val&1)===1)row.true++;else row.false++;
   row.callers[c]=(row.callers[c]||0)+1;
   callers[c]=(callers[c]||0)+1;
  }catch(e){errors++;}
 }
});
setTimeout(()=>{h.detach();send({kind:'thirdpersonPredicate',moduleBase:m.base.toString(),calls,errors,ps:counters,callers});},5000);
