// Bounded, read-only witnesses for Engine team_select -> reliable queue.
// The Lua call can return true without leaving a server command, so log the
// wrapper and the sender even when the name is not a plain C string.
send({s:'teamSelectTraceArmed'});
Interceptor.attach(at(0x3475538),{onEnter(){send({s:'teamSelectRegistered',lr:this.returnAddress.sub(b).toString(16)});}});
{
 let pcalls=0;
 Interceptor.attach(at(0x4486bc4),{onEnter(a){
  if(!globalThis.teamSelectSeen||globalThis.teamSelectSeen<8||pcalls>=6)return;
  const nargs=a[1].toInt32();
  if(nargs<0||nargs>4)return;
  try{
   const top=a[0].add(0x28).readPointer();
   const hex=top.sub((nargs+1)*8).readU64().toString(16);
   const obj=ptr('0x'+hex).and(ptr('0x7fffffffffff'));
   if(obj.add(9).readU8()!==9)return;
   const f=obj.add(0x28).readPointer();
   const mod=Process.findModuleByAddress(f);
   if(!mod||mod.name!=='libgame.so')return;
   pcalls++;
   send({s:'teamSelectPcall',nargs,f:f.sub(mod.base).toString(16)});
  }catch(e){}
 }});
}
{
 let active=0,seen=0;
 let wraps=0;
 Interceptor.attach(at(0x33c103c),{onEnter(){
  if(wraps++<8)send({s:'teamSelectWrapper',n:wraps});
 }});
 Interceptor.attach(at(0x21cca38),{onEnter(a){
  let early='';
  try{early=a[1].readCString()||'';}catch(e){early='';}
  if(seen>=8&&early!=='team_select')return;
  if(early!=='team_select'){seen++;globalThis.teamSelectSeen=seen;}
  let name='';
  try{name=a[1].readCString()||'';}catch(e){name='unreadable';}
  const client=a[0].toInt32();
  let conn=null;
  try{
   if(client>=0&&client<18)conn=at(0x54bb7e8).readPointer().add(client*0x1ec+8).readU32();
  }catch(e){conn=-2;}
  let front=null,ddl=null;
  try{front=at(0x553edf0).readU8();}catch(e){}
  try{ddl=at(0xaffa56c).readS32();}catch(e){}
  this.watch=true;
  active=Process.getCurrentThreadId();
  send({s:'teamSelectNative',client,name,selection:a[2].toInt32(),conn,front,ddl,lr:this.context.lr.sub(b).toString(16)});
 },onLeave(){if(this.watch)active=0;}});
 Interceptor.attach(at(0x367e708),{onLeave(r){if(active===Process.getCurrentThreadId())send({s:'teamSelectNameLookup',result:r.toInt32()});}});
 Interceptor.attach(at(0x134f924),{onEnter(a){
  if(active!==Process.getCurrentThreadId())return;
  let text='';try{text=a[1].readCString();}catch(e){text='unreadable';}
  send({s:'teamSelectReliableQueued',text});
 }});
}
{
 let count=0;
 Interceptor.attach(at(0x2990290),{onEnter(a){
  if(count++<8)send({s:'teamTraceClientCommand',client:a[0].toInt32(),count});
 }});
}
