// The Lua team_select wrapper uses the local client index. That index is -1 while
// the front-end byte is clear, and the sender ignores any client whose connection
// word is not 8. Client 0's word is 8, which is the same client the other menu
// commands already use. Only the one call inside the wrapper is changed.
send({s:'teamSelectClientFix'});
{
 const cave=at(0x3cd7b00);
 if(!cave.readU64().equals(0)||!cave.add(8).readU64().equals(0))throw new Error('client veneer padding not empty');
 const thunk=Memory.alloc(Process.pageSize);
 Memory.protect(thunk,Process.pageSize,'rwx');
 const w=new Arm64Writer(thunk,{pc:thunk});
 w.putPushRegReg('x29','lr');
 w.putLdrRegAddress('x16',at(0x337ef88));
 w.putBlrReg('x16');
 w.putInstruction(0x11000408);
 w.putCbzRegLabel('w8','none');
 w.putBLabel('back');
 w.putLabel('none');
 w.putInstruction(0x2a1f03e0);
 w.putLabel('back');
 w.putPopRegReg('x29','lr');
 w.putRet();
 w.flush();
 Memory.patchCode(cave,16,code=>{const p=new Arm64Writer(code,{pc:cave});p.putLdrRegAddress('x16',thunk);p.putBrReg('x16');p.flush();});
 Memory.patchCode(at(0x33c11d8),4,code=>{const p=new Arm64Writer(code,{pc:at(0x33c11d8)});p.putBlImm(cave);p.flush();});
 globalThis.teamSelectClientThunk=thunk;
}
// The UI frame's own caller is bl 0x337c1c0 at 0x337d25c. One later frame runs
// the original sender before entering the frame, so the trace hooks are not
// nested inside a Frida callback. Client 0, selection 2 (allies).
{
 const site=at(0x337d25c);
 const word=site.readU32();
 let imm=word&0x03ffffff;
 if((word>>>26)!==0x25)throw new Error('ui frame site is not a bl');
 if(imm&0x02000000)imm-=0x04000000;
 if(!site.add(imm*4).equals(at(0x337c1c0)))throw new Error('ui frame bl target changed');
 const cave=at(0x3cd7b10);
 if(!cave.readU64().equals(0)||!cave.add(8).readU64().equals(0))throw new Error('frame veneer padding not empty');
 const page=Memory.alloc(Process.pageSize);
 Memory.protect(page,Process.pageSize,'rwx');
 const flag=page.add(0xc00);
 const teamName=page.add(0xc10);
 flag.writeU8(0);
 teamName.writeUtf8String('team_select');
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
 w.putInstruction(0x2a1f03e0);          // mov w0, wzr
 w.putLdrRegAddress('x1',teamName);
 w.putInstruction(0x52800042);          // mov w2, #2
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
 let readyAt=0, armed=0;
 Interceptor.attach(at(0x337c1c0),{onEnter(){
  if(armed)return;
  let conn=-1;
  try{conn=at(0x54bb7e8).readPointer().add(8).readU32();}catch(e){return;}
  if(conn!==8)return;
  if(!readyAt){readyAt=Date.now();return;}
  if(Date.now()-readyAt<14000)return;
  armed=1;
  flag.writeU8(1);
  send({s:'teamSelectDirectArmed'});
 }});
 globalThis.teamSelectFramePage=page;
}
