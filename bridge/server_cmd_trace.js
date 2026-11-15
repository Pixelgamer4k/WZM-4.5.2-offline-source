// Read-only witnesses on the server side of client reliable commands
// (WZM_SERVER_CMD_TRACE=1). Static map, 4 Nov:
//   SV_ExecuteClientMessage clientCommand case: 0x3cd4fb4 reads the string into
//   sp+0xa0; w26 = command sequence, [x23] = last executed sequence.
//   0x3cd5080: no ucmd matched -> 0x3cbb774 gate -> game ClientCommand 0x29a53bc.
//   0x29a53bc: game ClientCommand(clientNum). "lui*" -> 0x29a6290(ent, kind).
send({s:'serverCmdTraceArmed'});
{
 let n=0;
 const hook=(addr,fn)=>{try{Interceptor.attach(at(addr),fn);}catch(e){send({s:'serverCmdHookFail',addr:addr.toString(16),e:String(e)});}};
 hook(0x3cd4fb8,function(){
  if(n>=12)return;
  const c=this.context;
  let text='';try{text=c.sp.add(0xa0).readCString()||'';}catch(e){text='?';}
  let last=null;try{last=c.x23.readS32();}catch(e){}
  n++;send({s:'svClientCmdRead',n,seq:c.x26.toInt32(),last,text:text.slice(0,120)});
 });
 let g=0;
 hook(0x3cd5084,function(){if(g++<40)send({s:'svClientCmdGate',ok:this.context.x0.toInt32()&1});});
 let u=0;
 hook(0x3cd5074,function(){if(u++<40)send({s:'svUcmdMatched',f:this.context.x8.sub(b).toString(16)});});
 let cc=0;
 hook(0x29a53bc,{onEnter(a){if(cc++<60)send({s:'svGameClientCommand',client:a[0].toInt32()});}});
 let lui=0;
 hook(0x29a6290,{onEnter(a){if(lui++<60)send({s:'svLuiHandler',kind:a[1].toInt32(),lr:this.returnAddress.sub(b).toString(16)});}});
 let lost=0;
 hook(0x3cd5374,function(){if(lost++<10)send({s:'svClientCmdLost',seq:this.context.x26.toInt32()});});
}
// Inside the lui handler 0x29a6290 (non-flag path): argc must be 4, argv[3]
// must equal the session word *[0x54d1ff0], the argv[1] index must resolve
// through 0x367e920, then 0x279d0ac(ent, 2) notifies the player entity.
{
 const hook=(addr,fn)=>{try{Interceptor.attach(at(addr),fn);}catch(e){send({s:'serverCmdHookFail',addr:addr.toString(16),e:String(e)});}};
 let k=0;const lim=()=>k++<200;
 hook(0x29a62cc,function(){if(lim())send({s:'luiFlag',v:this.context.x8.toInt32()&255});});
 hook(0x29a633c,function(){if(lim())send({s:'luiArgc',argc:this.context.x9.toInt32()});});
 hook(0x29a6360,function(){if(lim())send({s:'luiSession',arg:this.context.x0.toInt32(),want:this.context.x8.toInt32()});});
 hook(0x29a6378,function(){
  if(!lim())return;
  let q='',name='';try{const v=this.context.sp.add(0x10).readPointer();q=v.toString();name=v.readCString();}catch(e){name='?';}
  send({s:'luiLookup',ok:this.context.x0.toInt32()&1,q,name});
 });
 hook(0x279d0ac,{onEnter(a){if(lim())send({s:'luiNotify',ent:a[0].toString(),n:a[1].toInt32(),lr:this.returnAddress.sub(b).toString(16)});}});
}
// One-time dump of the lui index -> name table that 0x367e920 walks:
// node list at *[0xb235b10]: node[0]=hdr (count at hdr+0x14, names at hdr+0x20),
// node+0x10 u16 base index, node+8 next.
{
 let done=false;
 Interceptor.attach(at(0x29a6290),{onEnter(){
  if(done)return;done=true;
  const out=[];
  try{
   for(let n=at(0xb235b10).readPointer();!n.isNull()&&out.length<6000;n=n.add(8).readPointer()){
    const hdr=n.readPointer(),base=n.add(0x10).readU16(),cnt=hdr.add(0x14).readU32(),arr=hdr.add(0x20).readPointer();
    for(let i=0;i<cnt&&i<4000;i++){let s='';try{s=arr.add(i*8).readPointer().readCString();}catch(e){s='?';}out.push((base+i)+'='+s);}
   }
  }catch(e){out.push('err '+e);}
  const hit=out.filter(x=>/class|loadout|team|spawn|spectat|ready|select|kit|equip/i.test(x));
  send({s:'luiNameTable',total:out.length,hit});
 }});
}
