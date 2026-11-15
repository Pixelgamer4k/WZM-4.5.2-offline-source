// WZM_LUI_SEND="name:value@ms,name:value@ms,...": queue LUI menu responses the
// way the real menus do (0x21cca38(client 0, name, value) -> reliable
// `lui <index> <value> <session>`), with no menu open. Each item fires once,
// <ms> after client connection word 0 first reads 8. The call runs from the UI
// frame's own caller (bl 0x337c1c0 at 0x337d25c), not inside a Frida callback.
// The server side already turns these into luinotifyserver(name, value) on the
// player entity (verified 4 Nov t042051 for team_select).
// __LUI_SEND_SPEC__ is replaced by host_spawn.py.
{
 const spec='__LUI_SEND_SPEC__'.split(',').filter(x=>x).map(x=>{
  const m=/^([A-Za-z0-9_]+):(-?\d+)@(\d+)$/.exec(x.trim());
  if(!m)throw new Error('bad WZM_LUI_SEND item '+x);
  return {name:m[1],value:parseInt(m[2]),at:parseInt(m[3]),done:false};
 });
 send({s:'luiSendArmed',items:spec.map(i=>i.name+':'+i.value+'@'+i.at)});
 const site=at(0x337d25c);
 const word=site.readU32();
 let imm=word&0x03ffffff;
 if((word>>>26)!==0x25)throw new Error('ui frame site is not a bl');
 if(imm&0x02000000)imm-=0x04000000;
 if(!site.add(imm*4).equals(at(0x337c1c0)))throw new Error('ui frame bl target changed (another frame patch loaded?)');
 const cave=at(0x3cd7b10);
 if(!cave.readU64().equals(0)||!cave.add(8).readU64().equals(0))throw new Error('frame veneer padding not empty');
 const page=Memory.alloc(Process.pageSize);
 Memory.protect(page,Process.pageSize,'rwx');
 const flag=page.add(0xc00), valueSlot=page.add(0xc04), nameBuf=page.add(0xc40);
 flag.writeU8(0);
 const w=new Arm64Writer(page,{pc:page});
 w.putPushRegReg('x29','lr');
 w.putPushRegReg('x0','x1');
 w.putPushRegReg('x2','x3');
 w.putPushRegReg('x4','x5');
 w.putPushRegReg('x6','x7');
 w.putLdrRegAddress('x16',flag);
 w.putInstruction(0x39400208);          // ldrb w8, [x16]
 w.putCbzRegLabel('w8','orig');
 w.putInstruction(0x3900021f);          // strb wzr, [x16]
 w.putInstruction(0xb9400602);          // ldr w2, [x16, #4]
 w.putInstruction(0x2a1f03e0);          // mov w0, wzr
 w.putLdrRegAddress('x1',nameBuf);
 w.putLdrRegAddress('x16',at(0x21cca38));
 w.putBlrReg('x16');
 w.putLabel('orig');
 w.putPopRegReg('x6','x7');
 w.putPopRegReg('x4','x5');
 w.putPopRegReg('x2','x3');
 w.putPopRegReg('x0','x1');
 w.putLdrRegAddress('x16',at(0x337c1c0));
 w.putBlrReg('x16');
 w.putPopRegReg('x29','lr');
 w.putRet();
 w.flush();
 Memory.patchCode(cave,16,code=>{const p=new Arm64Writer(code,{pc:cave});p.putLdrRegAddress('x16',page);p.putBrReg('x16');p.flush();});
 Memory.patchCode(site,4,code=>{const p=new Arm64Writer(code,{pc:site});p.putBlImm(cave);p.flush();});
 let readyAt=0;
 Interceptor.attach(at(0x337c1c0),{onEnter(){
  if(flag.readU8())return;               // previous item not consumed yet
  let conn=-1;
  try{conn=at(0x54bb7e8).readPointer().add(8).readU32();}catch(e){return;}
  if(conn!==8)return;
  if(!readyAt){readyAt=Date.now();return;}
  const t=Date.now()-readyAt;
  const it=spec.find(i=>!i.done&&t>=i.at);
  if(!it)return;
  it.done=true;
  nameBuf.writeUtf8String(it.name);
  valueSlot.writeS32(it.value);
  flag.writeU8(1);
  send({s:'luiSendFired',name:it.name,value:it.value,t});
 }});
 globalThis.luiSendPage=page;
}
